use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::git::diff::FileDiff;
use crate::github::pull_request::{get_pull_request_files, list_pull_requests, PrInfo};
use crate::llm::client::LlmClient;
use crate::llm::prompts::{Language, PrMetadata, PromptBuilder};

/// ファイル単位の変更サマリー
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSummary {
    /// ファイルパス
    pub path: String,
    /// 変更内容の説明
    pub summary: String,
}

/// PR要約の結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrSummary {
    /// 変更全体の要約（何が変わったか）
    pub overall_summary: String,
    /// なぜ変わったか（推定）
    pub reason: String,
    /// ファイル単位の変更サマリー
    pub file_summaries: Vec<FileSummary>,
}

/// 整合性チェックの結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsistencyResult {
    /// PRタイトル・本文と差分が整合しているか
    pub is_consistent: bool,
    /// 乖離がある場合の警告メッセージ
    pub warnings: Vec<String>,
}

/// PR差分からAI要約を生成する
///
/// 1. GitHub APIからPR情報・差分を取得
/// 2. プロンプトを構築
/// 3. LLMクライアントで要約生成
pub async fn summarize_pr(
    owner: &str,
    repo: &str,
    pr_number: u64,
    token: &str,
    llm_client: &LlmClient,
) -> Result<PrSummary> {
    let (pr, diffs) = fetch_pr_data(owner, repo, pr_number, token).await?;

    let metadata = PrMetadata {
        title: pr.title.clone(),
        body: pr.body.clone(),
    };

    let builder = PromptBuilder::default();

    // 全体要約を生成
    let summary_prompts = builder.build_summary_prompt(&diffs, &metadata, Language::Japanese);
    let mut overall_parts = Vec::new();
    for prompt in &summary_prompts {
        let response = llm_client
            .chat(prompt)
            .await
            .context("要約生成のLLM呼び出しに失敗しました")?;
        overall_parts.push(response);
    }
    let overall_response = overall_parts.join("\n\n");

    // 全体要約レスポンスから構造化データを抽出
    let overall_summary = overall_response.clone();
    let reason = extract_reason(&overall_response);

    // ファイル単位のサマリーを生成
    let mut file_summaries = Vec::new();
    for diff in &diffs {
        let path = diff
            .new_path
            .as_deref()
            .or(diff.old_path.as_deref())
            .unwrap_or("(unknown)")
            .to_string();

        let file_prompt = builder.build_file_summary_prompt(diff, Language::Japanese);
        let file_response = llm_client
            .chat(&file_prompt)
            .await
            .with_context(|| format!("{path} のファイルサマリー生成に失敗しました"))?;

        file_summaries.push(FileSummary {
            path,
            summary: file_response,
        });
    }

    Ok(PrSummary {
        overall_summary,
        reason,
        file_summaries,
    })
}

/// PRタイトル・本文と実際の差分の整合性をチェックする
pub async fn check_pr_consistency(
    owner: &str,
    repo: &str,
    pr_number: u64,
    token: &str,
    llm_client: &LlmClient,
) -> Result<ConsistencyResult> {
    let (pr, diffs) = fetch_pr_data(owner, repo, pr_number, token).await?;

    let metadata = PrMetadata {
        title: pr.title.clone(),
        body: pr.body.clone(),
    };

    let builder = PromptBuilder::default();
    let prompts = builder.build_consistency_prompt(&diffs, &metadata, Language::Japanese);

    let mut all_responses = Vec::new();
    for prompt in &prompts {
        let response = llm_client
            .chat(prompt)
            .await
            .context("整合性チェックのLLM呼び出しに失敗しました")?;
        all_responses.push(response);
    }

    let combined = all_responses.join("\n\n");
    let (is_consistent, warnings) = parse_consistency_response(&combined);

    Ok(ConsistencyResult {
        is_consistent,
        warnings,
    })
}

/// GitHub APIからPR情報と差分ファイルを取得する
async fn fetch_pr_data(
    owner: &str,
    repo: &str,
    pr_number: u64,
    token: &str,
) -> Result<(PrInfo, Vec<FileDiff>)> {
    let prs = list_pull_requests(owner, repo, token)
        .await
        .context("PRリストの取得に失敗しました")?;

    let pr = prs
        .into_iter()
        .find(|p| p.number == pr_number)
        .with_context(|| format!("PR #{pr_number} が見つかりませんでした"))?;

    let diffs = get_pull_request_files(owner, repo, pr_number, token)
        .await
        .context("PR差分ファイルの取得に失敗しました")?;

    Ok((pr, diffs))
}

/// LLMの要約レスポンスから「なぜ変わったか」部分を抽出する
///
/// 構造化された応答がない場合は要約全体をそのまま返す
fn extract_reason(response: &str) -> String {
    // LLMレスポンスからreason/why部分をヒューリスティックに抽出
    let lower = response.to_lowercase();
    for marker in ["なぜ", "理由", "目的", "why", "reason", "purpose"] {
        if let Some(pos) = lower.find(marker) {
            // マーカー位置から次の段落区切りまでを取得
            let start = response[..pos]
                .rfind('\n')
                .map(|p| p + 1)
                .unwrap_or(pos);
            let remaining = &response[start..];
            let end = remaining
                .find("\n\n")
                .unwrap_or(remaining.len());
            let extracted = remaining[..end].trim();
            if !extracted.is_empty() {
                return extracted.to_string();
            }
        }
    }
    // 抽出できなかった場合は要約全体を返す
    response.to_string()
}

/// 整合性チェックのLLMレスポンスを解析する
///
/// "High" → is_consistent: true
/// "Medium" / "Low" → is_consistent: false + 警告メッセージ抽出
fn parse_consistency_response(response: &str) -> (bool, Vec<String>) {
    let lower = response.to_lowercase();

    // 一致度レーティングの検出
    let is_consistent = lower.contains("high")
        && !lower.contains("medium")
        && !lower.contains("low");

    if is_consistent {
        return (true, Vec::new());
    }

    // 警告メッセージの抽出
    let mut warnings = Vec::new();
    for line in response.lines() {
        let trimmed = line.trim();
        // 箇条書きまたは番号付きリスト項目を警告として抽出
        if (trimmed.starts_with('-') || trimmed.starts_with('•') || trimmed.starts_with('*'))
            && trimmed.len() > 2
        {
            let warning = trimmed.trim_start_matches(['-', '•', '*', ' ']).trim();
            if !warning.is_empty() {
                warnings.push(warning.to_string());
            }
        } else if trimmed
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_digit())
            && trimmed.contains('.')
        {
            if let Some(text) = trimmed.split_once('.').map(|(_, t)| t.trim()) {
                if !text.is_empty() {
                    warnings.push(text.to_string());
                }
            }
        }
    }

    // 警告が抽出されなかった場合はレスポンス全体を警告として返す
    if warnings.is_empty() {
        warnings.push(response.to_string());
    }

    (false, warnings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pr_summary_serializes() {
        let summary = PrSummary {
            overall_summary: "テスト要約".to_string(),
            reason: "テスト理由".to_string(),
            file_summaries: vec![FileSummary {
                path: "src/main.rs".to_string(),
                summary: "ファイルの変更".to_string(),
            }],
        };
        let json = serde_json::to_value(&summary).unwrap();
        assert_eq!(json["overall_summary"], "テスト要約");
        assert_eq!(json["reason"], "テスト理由");
        assert_eq!(json["file_summaries"][0]["path"], "src/main.rs");
        assert_eq!(json["file_summaries"][0]["summary"], "ファイルの変更");
    }

    #[test]
    fn test_pr_summary_deserializes() {
        let json = r#"{
            "overall_summary": "summary",
            "reason": "reason",
            "file_summaries": [
                { "path": "a.rs", "summary": "changed a" }
            ]
        }"#;
        let summary: PrSummary = serde_json::from_str(json).unwrap();
        assert_eq!(summary.overall_summary, "summary");
        assert_eq!(summary.reason, "reason");
        assert_eq!(summary.file_summaries.len(), 1);
    }

    #[test]
    fn test_consistency_result_serializes() {
        let result = ConsistencyResult {
            is_consistent: false,
            warnings: vec!["warning 1".to_string(), "warning 2".to_string()],
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["is_consistent"], false);
        assert_eq!(json["warnings"][0], "warning 1");
        assert_eq!(json["warnings"][1], "warning 2");
    }

    #[test]
    fn test_consistency_result_consistent() {
        let result = ConsistencyResult {
            is_consistent: true,
            warnings: vec![],
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["is_consistent"], true);
        assert!(json["warnings"].as_array().unwrap().is_empty());
    }

    #[test]
    fn test_extract_reason_with_japanese_marker() {
        let response = "変更の概要です。\n\n理由: パフォーマンス改善のため\n\n詳細な変更点";
        let reason = extract_reason(response);
        assert!(reason.contains("理由"));
        assert!(reason.contains("パフォーマンス改善"));
    }

    #[test]
    fn test_extract_reason_with_english_marker() {
        let response = "Summary of changes.\n\nWhy: To improve performance.\n\nDetails here.";
        let reason = extract_reason(response);
        assert!(reason.contains("Why"));
        assert!(reason.contains("improve performance"));
    }

    #[test]
    fn test_extract_reason_no_marker_returns_full() {
        let response = "Just a plain summary without any markers.";
        let reason = extract_reason(response);
        assert_eq!(reason, response);
    }

    #[test]
    fn test_parse_consistency_high() {
        let response = "The consistency is High. Everything matches well.";
        let (is_consistent, warnings) = parse_consistency_response(response);
        assert!(is_consistent);
        assert!(warnings.is_empty());
    }

    #[test]
    fn test_parse_consistency_medium_with_bullets() {
        let response =
            "The consistency is Medium.\n- Missing test documentation\n- Title doesn't match";
        let (is_consistent, warnings) = parse_consistency_response(response);
        assert!(!is_consistent);
        assert_eq!(warnings.len(), 2);
        assert!(warnings[0].contains("Missing test documentation"));
        assert!(warnings[1].contains("Title doesn't match"));
    }

    #[test]
    fn test_parse_consistency_low_with_numbered_list() {
        let response = "Consistency: Low\n1. Title says bug fix but adds new feature\n2. Missing migration not mentioned";
        let (is_consistent, warnings) = parse_consistency_response(response);
        assert!(!is_consistent);
        assert_eq!(warnings.len(), 2);
    }

    #[test]
    fn test_parse_consistency_medium_no_list_items() {
        let response = "Consistency is Medium. The PR description is vague.";
        let (is_consistent, warnings) = parse_consistency_response(response);
        assert!(!is_consistent);
        // 警告が抽出できない場合はレスポンス全体が警告になる
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0], response);
    }

    #[test]
    fn test_file_summary_serializes() {
        let fs = FileSummary {
            path: "lib/mod.rs".to_string(),
            summary: "モジュール追加".to_string(),
        };
        let json = serde_json::to_value(&fs).unwrap();
        assert_eq!(json["path"], "lib/mod.rs");
        assert_eq!(json["summary"], "モジュール追加");
    }
}
