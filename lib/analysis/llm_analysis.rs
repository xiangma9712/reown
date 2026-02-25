use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::git::diff::FileDiff;
use crate::github::pull_request::PrInfo;
use crate::llm::client::LlmClient;
use crate::llm::prompts::{Language, PrMetadata, PromptBuilder};

use super::risk::{AnalysisResult, RiskLevel};

/// LLMによる影響範囲分析の結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmAnalysisResult {
    /// 影響を受けるモジュール・機能の一覧
    pub affected_modules: Vec<AffectedModule>,
    /// 破壊的変更の検出結果
    pub breaking_changes: Vec<BreakingChange>,
    /// リスク要因（LLMが指摘した注意点）
    pub risk_warnings: Vec<String>,
    /// LLMによるリスクレベル判定
    pub llm_risk_level: RiskLevel,
    /// 変更の要約（LLM生成）
    pub summary: String,
}

/// 影響を受けるモジュール
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AffectedModule {
    /// モジュール名
    pub name: String,
    /// 影響の説明
    pub description: String,
}

/// 破壊的変更
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakingChange {
    /// 対象ファイルパス
    pub file_path: String,
    /// 破壊的変更の説明
    pub description: String,
    /// 深刻度
    pub severity: BreakingChangeSeverity,
}

/// 破壊的変更の深刻度
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum BreakingChangeSeverity {
    /// 警告レベル（互換性が失われる可能性がある）
    Warning,
    /// 重大（確実に互換性が失われる）
    Critical,
}

/// 静的分析とLLM分析を統合したハイブリッド分析結果
#[derive(Debug, Clone, Serialize)]
pub struct HybridAnalysisResult {
    /// 静的分析の結果
    pub static_analysis: AnalysisResult,
    /// LLM分析の結果
    pub llm_analysis: LlmAnalysisResult,
    /// 統合されたリスクレベル（静的分析とLLM分析の高い方）
    pub combined_risk_level: RiskLevel,
}

/// LLMを使用してPR差分の影響範囲を分析する
pub async fn analyze_with_llm(
    diffs: &[FileDiff],
    metadata: &PrMetadata,
    llm_client: &LlmClient,
) -> Result<LlmAnalysisResult> {
    let builder = PromptBuilder::default();
    let prompts = builder.build_impact_analysis_prompt(diffs, metadata, Language::Japanese);

    let mut all_responses = Vec::new();
    for prompt in &prompts {
        let response = llm_client
            .chat(prompt)
            .await
            .context("影響範囲分析のLLM呼び出しに失敗しました")?;
        all_responses.push(response);
    }

    let combined = all_responses.join("\n\n");
    parse_llm_analysis_response(&combined)
}

/// 静的分析とLLM分析の結果を統合する
pub fn merge_analysis(
    static_analysis: AnalysisResult,
    llm_analysis: LlmAnalysisResult,
) -> HybridAnalysisResult {
    let combined_risk_level =
        higher_risk_level(&static_analysis.risk.level, &llm_analysis.llm_risk_level);

    HybridAnalysisResult {
        static_analysis,
        llm_analysis,
        combined_risk_level,
    }
}

/// 2つのリスクレベルのうち高い方を返す
fn higher_risk_level(a: &RiskLevel, b: &RiskLevel) -> RiskLevel {
    let to_num = |level: &RiskLevel| match level {
        RiskLevel::Low => 0,
        RiskLevel::Medium => 1,
        RiskLevel::High => 2,
    };
    if to_num(a) >= to_num(b) {
        a.clone()
    } else {
        b.clone()
    }
}

/// LLMのレスポンスを解析してLlmAnalysisResultを構築する
fn parse_llm_analysis_response(response: &str) -> Result<LlmAnalysisResult> {
    let affected_modules = extract_affected_modules(response);
    let breaking_changes = extract_breaking_changes(response);
    let risk_warnings = extract_risk_warnings(response);
    let llm_risk_level = extract_risk_level(response);
    let summary = extract_summary(response);

    Ok(LlmAnalysisResult {
        affected_modules,
        breaking_changes,
        risk_warnings,
        llm_risk_level,
        summary,
    })
}

/// LLMレスポンスから影響モジュールを抽出する
fn extract_affected_modules(response: &str) -> Vec<AffectedModule> {
    let mut modules = Vec::new();
    let mut in_section = false;

    for line in response.lines() {
        let trimmed = line.trim();

        if is_specific_section_header(
            trimmed,
            &["影響モジュール", "AFFECTED_MODULES", "affected module"],
        ) {
            in_section = true;
            continue;
        }

        // 次のセクションヘッダーに到達したら終了
        if in_section && is_section_header(trimmed) {
            break;
        }

        if in_section && is_list_item(trimmed) {
            let text = strip_list_prefix(trimmed);
            if let Some((name, desc)) = split_name_description(&text) {
                modules.push(AffectedModule {
                    name,
                    description: desc,
                });
            } else if !text.is_empty() {
                modules.push(AffectedModule {
                    name: text.clone(),
                    description: String::new(),
                });
            }
        }
    }

    modules
}

/// LLMレスポンスから破壊的変更を抽出する
fn extract_breaking_changes(response: &str) -> Vec<BreakingChange> {
    let mut changes = Vec::new();
    let mut in_section = false;

    for line in response.lines() {
        let trimmed = line.trim();

        if is_specific_section_header(
            trimmed,
            &["破壊的変更", "BREAKING_CHANGES", "breaking change"],
        ) {
            in_section = true;
            continue;
        }

        if in_section && is_section_header(trimmed) {
            break;
        }

        if in_section && is_list_item(trimmed) {
            let text = strip_list_prefix(trimmed);
            if text.is_empty()
                || text.to_lowercase().contains("なし")
                || text.to_lowercase() == "none"
            {
                continue;
            }

            let severity = if text.contains("重大") || text.to_lowercase().contains("critical") {
                BreakingChangeSeverity::Critical
            } else {
                BreakingChangeSeverity::Warning
            };

            let file_path = extract_file_path_from_text(&text);
            changes.push(BreakingChange {
                file_path,
                description: text,
                severity,
            });
        }
    }

    changes
}

/// LLMレスポンスからリスク警告を抽出する
fn extract_risk_warnings(response: &str) -> Vec<String> {
    let mut warnings = Vec::new();
    let mut in_section = false;

    for line in response.lines() {
        let trimmed = line.trim();

        if is_risk_section_header(trimmed) {
            in_section = true;
            continue;
        }

        if in_section && is_section_header(trimmed) {
            break;
        }

        if in_section && is_list_item(trimmed) {
            let text = strip_list_prefix(trimmed);
            if !text.is_empty()
                && !text.to_lowercase().contains("なし")
                && text.to_lowercase() != "none"
            {
                warnings.push(text);
            }
        }
    }

    warnings
}

/// リスクセクションのヘッダーかどうかを判定する
///
/// "## リスク" や "### リスク要因" はマッチするが、
/// "リスクレベル" や "- ...注意..." のような行はマッチしない
fn is_risk_section_header(line: &str) -> bool {
    let trimmed = line.trim();

    // ヘッダー記法（# で始まる）の場合のみリスクセクションとして判定
    if trimmed.starts_with('#') {
        let header_text = trimmed.trim_start_matches('#').trim();
        // "リスクレベル" は別セクションなので除外
        if header_text.contains("リスクレベル")
            || header_text.contains("risk_level")
            || header_text.contains("risk level")
        {
            return false;
        }
        return header_text.contains("リスク")
            || header_text.contains("RISK_WARNINGS")
            || header_text.contains("risk warning")
            || header_text.contains("注意");
    }

    // "リスク:" や "注意点:" のようなラベル行
    if (trimmed.ends_with(':') || trimmed.ends_with('：'))
        && (trimmed.contains("リスク")
            || trimmed.contains("RISK_WARNINGS")
            || trimmed.contains("注意"))
        && !trimmed.contains("リスクレベル")
    {
        return true;
    }

    false
}

/// LLMレスポンスからリスクレベルを抽出する
fn extract_risk_level(response: &str) -> RiskLevel {
    let lower = response.to_lowercase();

    // 明示的なリスクレベル表記を探す
    for line in lower.lines() {
        let trimmed = line.trim();
        if trimmed.contains("リスクレベル")
            || trimmed.contains("risk_level")
            || trimmed.contains("risk level")
        {
            if trimmed.contains("high") || trimmed.contains("高") {
                return RiskLevel::High;
            }
            if trimmed.contains("medium") || trimmed.contains("中") {
                return RiskLevel::Medium;
            }
            if trimmed.contains("low") || trimmed.contains("低") {
                return RiskLevel::Low;
            }
        }
    }

    // フォールバック: レスポンス全体からリスクキーワードを検索
    if lower.contains("high risk") || lower.contains("高リスク") {
        return RiskLevel::High;
    }
    if lower.contains("medium risk") || lower.contains("中リスク") {
        return RiskLevel::Medium;
    }

    RiskLevel::Low
}

/// LLMレスポンスから要約を抽出する
fn extract_summary(response: &str) -> String {
    let mut in_section = false;
    let mut summary_lines = Vec::new();

    for line in response.lines() {
        let trimmed = line.trim();

        if is_specific_section_header(trimmed, &["要約", "SUMMARY", "summary"]) {
            in_section = true;
            continue;
        }

        if in_section && is_section_header(trimmed) {
            break;
        }

        if in_section && !trimmed.is_empty() {
            summary_lines.push(trimmed.to_string());
        }
    }

    if summary_lines.is_empty() {
        // 要約セクションが見つからない場合、最初の段落を使用
        let first_para: Vec<&str> = response
            .lines()
            .take_while(|l| !l.trim().is_empty())
            .filter(|l| !is_section_header(l.trim()))
            .collect();
        if !first_para.is_empty() {
            return first_para.join("\n");
        }
        return response.lines().next().unwrap_or("").to_string();
    }

    summary_lines.join("\n")
}

// ── ヘルパー関数 ──────────────────────────────────────────────────────

/// 特定のキーワードを含むセクションヘッダーかどうかを判定する
///
/// `# keyword` や `keyword:` のようなヘッダー形式のみマッチする。
/// リスト項目の中にキーワードが含まれる場合はマッチしない。
fn is_specific_section_header(line: &str, keywords: &[&str]) -> bool {
    let trimmed = line.trim();

    // "# ..." 形式のヘッダー
    if trimmed.starts_with('#') {
        let header_text = trimmed.trim_start_matches('#').trim().to_lowercase();
        return keywords
            .iter()
            .any(|kw| header_text.contains(&kw.to_lowercase()));
    }

    // "keyword:" 形式のラベル行（リスト項目ではない）
    if !is_list_item(trimmed) && (trimmed.ends_with(':') || trimmed.ends_with('：')) {
        let lower = trimmed.to_lowercase();
        return keywords.iter().any(|kw| lower.contains(&kw.to_lowercase()));
    }

    false
}

fn is_section_header(line: &str) -> bool {
    line.starts_with('#') || line.starts_with("##") || line.ends_with(':') || line.ends_with('：')
}

fn is_list_item(line: &str) -> bool {
    line.starts_with('-')
        || line.starts_with('•')
        || line.starts_with('*')
        || line.chars().next().is_some_and(|c| c.is_ascii_digit()) && line.contains('.')
}

fn strip_list_prefix(line: &str) -> String {
    let stripped = line.trim_start_matches(['-', '•', '*', ' ']).trim();

    // 番号付きリストの場合
    if stripped.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        if let Some((_, rest)) = stripped.split_once('.') {
            return rest.trim().to_string();
        }
    }

    stripped.to_string()
}

fn split_name_description(text: &str) -> Option<(String, String)> {
    // "名前: 説明" or "名前 - 説明" のパターンを試行
    for separator in [":", "：", " - ", " — "] {
        if let Some((name, desc)) = text.split_once(separator) {
            let name = name.trim().to_string();
            let desc = desc.trim().to_string();
            if !name.is_empty() && !desc.is_empty() {
                return Some((name, desc));
            }
        }
    }
    None
}

fn extract_file_path_from_text(text: &str) -> String {
    // バッククォートで囲まれたパスを抽出
    if let Some(start) = text.find('`') {
        if let Some(end) = text[start + 1..].find('`') {
            let path = &text[start + 1..start + 1 + end];
            if path.contains('/') || path.contains('.') {
                return path.to_string();
            }
        }
    }
    String::new()
}

/// PR情報と差分からLLMを使用したハイブリッド分析を実行する
pub async fn analyze_pr_with_llm(
    pr: &PrInfo,
    diffs: &[FileDiff],
    llm_client: &LlmClient,
) -> Result<HybridAnalysisResult> {
    let static_analysis = super::risk::analyze_pr_risk(pr, diffs);

    let metadata = PrMetadata {
        title: pr.title.clone(),
        body: pr.body.clone(),
    };

    let llm_analysis = analyze_with_llm(diffs, &metadata, llm_client).await?;

    Ok(merge_analysis(static_analysis, llm_analysis))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::classify::ChangeCategory;
    use crate::analysis::risk::{AnalysisSummary, CategoryCount, RiskFactor, RiskScore};

    #[test]
    fn test_llm_analysis_result_serializes() {
        let result = LlmAnalysisResult {
            affected_modules: vec![AffectedModule {
                name: "auth".to_string(),
                description: "認証モジュール".to_string(),
            }],
            breaking_changes: vec![BreakingChange {
                file_path: "src/api.rs".to_string(),
                description: "APIの引数変更".to_string(),
                severity: BreakingChangeSeverity::Warning,
            }],
            risk_warnings: vec!["テストが不足".to_string()],
            llm_risk_level: RiskLevel::Medium,
            summary: "認証モジュールの変更".to_string(),
        };

        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["affected_modules"][0]["name"], "auth");
        assert_eq!(json["breaking_changes"][0]["file_path"], "src/api.rs");
        assert_eq!(json["breaking_changes"][0]["severity"], "Warning");
        assert_eq!(json["risk_warnings"][0], "テストが不足");
        assert_eq!(json["llm_risk_level"], "Medium");
        assert_eq!(json["summary"], "認証モジュールの変更");
    }

    #[test]
    fn test_llm_analysis_result_deserializes() {
        let json = r#"{
            "affected_modules": [{"name": "core", "description": "コアロジック"}],
            "breaking_changes": [],
            "risk_warnings": [],
            "llm_risk_level": "Low",
            "summary": "軽微な変更"
        }"#;
        let result: LlmAnalysisResult = serde_json::from_str(json).unwrap();
        assert_eq!(result.affected_modules.len(), 1);
        assert_eq!(result.affected_modules[0].name, "core");
        assert_eq!(result.llm_risk_level, RiskLevel::Low);
    }

    #[test]
    fn test_parse_llm_response_with_all_sections() {
        let response = r#"## 要約
認証モジュールにOAuth2サポートを追加する変更です。

## 影響モジュール
- auth: 認証フローの変更
- api: エンドポイントの追加

## 破壊的変更
- `src/auth/login.rs` のログインAPIの引数が変更（重大）

## リスク
- セッション管理の互換性に注意が必要
- テストカバレッジが不足

## リスクレベル: High"#;

        let result = parse_llm_analysis_response(response).unwrap();
        assert_eq!(result.affected_modules.len(), 2);
        assert_eq!(result.affected_modules[0].name, "auth");
        assert_eq!(result.affected_modules[1].name, "api");
        assert_eq!(result.breaking_changes.len(), 1);
        assert_eq!(
            result.breaking_changes[0].severity,
            BreakingChangeSeverity::Critical
        );
        assert_eq!(result.breaking_changes[0].file_path, "src/auth/login.rs");
        assert_eq!(result.risk_warnings.len(), 2);
        assert_eq!(result.llm_risk_level, RiskLevel::High);
        assert!(result.summary.contains("OAuth2"));
    }

    #[test]
    fn test_parse_llm_response_no_breaking_changes() {
        let response = r#"## 要約
ドキュメントの更新のみ。

## 影響モジュール
- docs: ドキュメント更新

## 破壊的変更
- なし

## リスク
- なし

## リスクレベル: Low"#;

        let result = parse_llm_analysis_response(response).unwrap();
        assert_eq!(result.affected_modules.len(), 1);
        assert!(result.breaking_changes.is_empty());
        assert!(result.risk_warnings.is_empty());
        assert_eq!(result.llm_risk_level, RiskLevel::Low);
    }

    #[test]
    fn test_parse_llm_response_minimal() {
        let response = "この変更は軽微です。リスクは低いです。";
        let result = parse_llm_analysis_response(response).unwrap();
        assert!(result.affected_modules.is_empty());
        assert!(result.breaking_changes.is_empty());
        assert!(result.risk_warnings.is_empty());
        assert_eq!(result.llm_risk_level, RiskLevel::Low);
    }

    #[test]
    fn test_extract_risk_level_high() {
        assert_eq!(extract_risk_level("リスクレベル: High"), RiskLevel::High);
        assert_eq!(extract_risk_level("リスクレベル: 高"), RiskLevel::High);
        assert_eq!(
            extract_risk_level("This is a high risk change"),
            RiskLevel::High
        );
    }

    #[test]
    fn test_extract_risk_level_medium() {
        assert_eq!(
            extract_risk_level("リスクレベル: Medium"),
            RiskLevel::Medium
        );
        assert_eq!(extract_risk_level("中リスクの変更です"), RiskLevel::Medium);
    }

    #[test]
    fn test_extract_risk_level_low_default() {
        assert_eq!(extract_risk_level("特に問題なし"), RiskLevel::Low);
    }

    #[test]
    fn test_merge_analysis_takes_higher_risk() {
        let static_result = AnalysisResult {
            pr_number: 1,
            risk: RiskScore {
                score: 10,
                level: RiskLevel::Low,
                factors: vec![],
            },
            files: vec![],
            summary: AnalysisSummary {
                total_files: 1,
                total_additions: 5,
                total_deletions: 0,
                has_test_changes: false,
                categories: vec![],
            },
        };

        let llm_result = LlmAnalysisResult {
            affected_modules: vec![],
            breaking_changes: vec![BreakingChange {
                file_path: "src/api.rs".to_string(),
                description: "API変更".to_string(),
                severity: BreakingChangeSeverity::Critical,
            }],
            risk_warnings: vec!["破壊的変更あり".to_string()],
            llm_risk_level: RiskLevel::High,
            summary: "危険な変更".to_string(),
        };

        let hybrid = merge_analysis(static_result, llm_result);
        assert_eq!(hybrid.combined_risk_level, RiskLevel::High);
    }

    #[test]
    fn test_merge_analysis_static_higher() {
        let static_result = AnalysisResult {
            pr_number: 1,
            risk: RiskScore {
                score: 80,
                level: RiskLevel::High,
                factors: vec![RiskFactor {
                    name: "sensitive".to_string(),
                    score: 25,
                    description: "auth files".to_string(),
                }],
            },
            files: vec![],
            summary: AnalysisSummary {
                total_files: 20,
                total_additions: 500,
                total_deletions: 200,
                has_test_changes: false,
                categories: vec![CategoryCount {
                    category: ChangeCategory::Logic,
                    count: 20,
                }],
            },
        };

        let llm_result = LlmAnalysisResult {
            affected_modules: vec![],
            breaking_changes: vec![],
            risk_warnings: vec![],
            llm_risk_level: RiskLevel::Low,
            summary: "安全な変更".to_string(),
        };

        let hybrid = merge_analysis(static_result, llm_result);
        assert_eq!(hybrid.combined_risk_level, RiskLevel::High);
    }

    #[test]
    fn test_higher_risk_level() {
        assert_eq!(
            higher_risk_level(&RiskLevel::Low, &RiskLevel::Low),
            RiskLevel::Low
        );
        assert_eq!(
            higher_risk_level(&RiskLevel::Low, &RiskLevel::Medium),
            RiskLevel::Medium
        );
        assert_eq!(
            higher_risk_level(&RiskLevel::Low, &RiskLevel::High),
            RiskLevel::High
        );
        assert_eq!(
            higher_risk_level(&RiskLevel::Medium, &RiskLevel::Low),
            RiskLevel::Medium
        );
        assert_eq!(
            higher_risk_level(&RiskLevel::High, &RiskLevel::Low),
            RiskLevel::High
        );
        assert_eq!(
            higher_risk_level(&RiskLevel::High, &RiskLevel::High),
            RiskLevel::High
        );
    }

    #[test]
    fn test_hybrid_analysis_result_serializes() {
        let result = HybridAnalysisResult {
            static_analysis: AnalysisResult {
                pr_number: 42,
                risk: RiskScore {
                    score: 30,
                    level: RiskLevel::Medium,
                    factors: vec![],
                },
                files: vec![],
                summary: AnalysisSummary {
                    total_files: 3,
                    total_additions: 100,
                    total_deletions: 50,
                    has_test_changes: true,
                    categories: vec![],
                },
            },
            llm_analysis: LlmAnalysisResult {
                affected_modules: vec![],
                breaking_changes: vec![],
                risk_warnings: vec![],
                llm_risk_level: RiskLevel::Medium,
                summary: "中程度の変更".to_string(),
            },
            combined_risk_level: RiskLevel::Medium,
        };

        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["static_analysis"]["pr_number"], 42);
        assert_eq!(json["llm_analysis"]["summary"], "中程度の変更");
        assert_eq!(json["combined_risk_level"], "Medium");
    }

    #[test]
    fn test_extract_affected_modules_empty() {
        let response = "特に影響なし";
        assert!(extract_affected_modules(response).is_empty());
    }

    #[test]
    fn test_extract_breaking_changes_none_keyword() {
        let response = "## 破壊的変更\n- なし\n## 次のセクション";
        assert!(extract_breaking_changes(response).is_empty());
    }

    #[test]
    fn test_extract_file_path_from_text() {
        assert_eq!(
            extract_file_path_from_text("`src/main.rs` の変更"),
            "src/main.rs"
        );
        assert_eq!(extract_file_path_from_text("変更なし"), "");
    }

    #[test]
    fn test_split_name_description() {
        assert_eq!(
            split_name_description("auth: 認証モジュール"),
            Some(("auth".to_string(), "認証モジュール".to_string()))
        );
        assert_eq!(
            split_name_description("api - エンドポイント追加"),
            Some(("api".to_string(), "エンドポイント追加".to_string()))
        );
        assert_eq!(split_name_description("単独テキスト"), None);
    }

    #[test]
    fn test_breaking_change_severity_serializes() {
        let json = serde_json::to_value(&BreakingChangeSeverity::Critical).unwrap();
        assert_eq!(json, "Critical");
        let json = serde_json::to_value(&BreakingChangeSeverity::Warning).unwrap();
        assert_eq!(json, "Warning");
    }
}
