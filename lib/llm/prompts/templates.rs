use crate::git::diff::{FileDiff, LineOrigin};

/// 出力言語
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    Japanese,
    English,
}

/// PRメタ情報
#[derive(Debug, Clone)]
pub struct PrMetadata {
    pub title: String,
    pub body: String,
}

/// トークン数上限のデフォルト値（おおよそ文字数ベースの簡易推定）
const DEFAULT_MAX_CHARS: usize = 80_000;

/// プロンプトビルダー
///
/// `Vec<FileDiff>` + PRメタ情報からLLM用プロンプト文字列を組み立てる。
/// 差分が大きい場合はチャンク分割する。
pub struct PromptBuilder {
    max_chars: usize,
}

impl Default for PromptBuilder {
    fn default() -> Self {
        Self {
            max_chars: DEFAULT_MAX_CHARS,
        }
    }
}

impl PromptBuilder {
    /// トークン数上限をカスタマイズしてビルダーを作成する
    pub fn with_max_chars(max_chars: usize) -> Self {
        Self { max_chars }
    }

    /// 要約生成用プロンプトを構築する
    ///
    /// 差分が大きい場合はチャンク分割して複数のプロンプトを返す。
    pub fn build_summary_prompt(
        &self,
        diffs: &[FileDiff],
        metadata: &PrMetadata,
        lang: Language,
    ) -> Vec<String> {
        let diff_text = format_diffs(diffs);
        let chunks = self.split_into_chunks(&diff_text);

        chunks
            .into_iter()
            .enumerate()
            .map(|(i, chunk)| {
                summary_template(metadata, &chunk, lang, i + 1, self.chunk_count(&diff_text))
            })
            .collect()
    }

    /// 整合性チェック用プロンプトを構築する
    ///
    /// PRタイトル・本文と実際の差分の一致をチェックするプロンプトを返す。
    /// 差分が大きい場合はチャンク分割して複数のプロンプトを返す。
    pub fn build_consistency_prompt(
        &self,
        diffs: &[FileDiff],
        metadata: &PrMetadata,
        lang: Language,
    ) -> Vec<String> {
        let diff_text = format_diffs(diffs);
        let chunks = self.split_into_chunks(&diff_text);

        chunks
            .into_iter()
            .enumerate()
            .map(|(i, chunk)| {
                consistency_template(metadata, &chunk, lang, i + 1, self.chunk_count(&diff_text))
            })
            .collect()
    }

    /// 影響範囲分析・破壊的変更検出用プロンプトを構築する
    ///
    /// 差分が大きい場合はチャンク分割して複数のプロンプトを返す。
    pub fn build_impact_analysis_prompt(
        &self,
        diffs: &[FileDiff],
        metadata: &PrMetadata,
        lang: Language,
    ) -> Vec<String> {
        let diff_text = format_diffs(diffs);
        let chunks = self.split_into_chunks(&diff_text);

        chunks
            .into_iter()
            .enumerate()
            .map(|(i, chunk)| {
                impact_analysis_template(
                    metadata,
                    &chunk,
                    lang,
                    i + 1,
                    self.chunk_count(&diff_text),
                )
            })
            .collect()
    }

    /// ファイル単位のサマリー生成用プロンプトを構築する
    pub fn build_file_summary_prompt(&self, diff: &FileDiff, lang: Language) -> String {
        let diff_text = format_single_diff(diff);
        file_summary_template(diff, &diff_text, lang)
    }

    /// 差分テキストをチャンク分割する
    fn split_into_chunks(&self, diff_text: &str) -> Vec<String> {
        if diff_text.len() <= self.max_chars {
            return vec![diff_text.to_string()];
        }

        let mut chunks = Vec::new();
        let mut current = String::new();

        // ファイル境界（"--- " で始まる行）で分割を試みる
        for line in diff_text.lines() {
            if line.starts_with("--- ")
                && current.len() + line.len() > self.max_chars
                && !current.is_empty()
            {
                chunks.push(current);
                current = String::new();
            }
            if !current.is_empty() {
                current.push('\n');
            }
            current.push_str(line);
        }

        if !current.is_empty() {
            chunks.push(current);
        }

        // ファイル境界分割後もまだ大きいチャンクがある場合は強制分割
        let mut result = Vec::new();
        for chunk in chunks {
            if chunk.len() <= self.max_chars {
                result.push(chunk);
            } else {
                result.extend(force_split(&chunk, self.max_chars));
            }
        }

        result
    }

    fn chunk_count(&self, diff_text: &str) -> usize {
        self.split_into_chunks(diff_text).len()
    }
}

/// 差分テキストを強制的に指定サイズで分割する
fn force_split(text: &str, max_chars: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();

    for line in text.lines() {
        if !current.is_empty() && current.len() + line.len() + 1 > max_chars {
            chunks.push(current);
            current = String::new();
        }
        if !current.is_empty() {
            current.push('\n');
        }
        current.push_str(line);
    }

    if !current.is_empty() {
        chunks.push(current);
    }

    chunks
}

// ── テンプレート ─────────────────────────────────────────────────────

fn summary_template(
    metadata: &PrMetadata,
    diff_chunk: &str,
    lang: Language,
    chunk_index: usize,
    total_chunks: usize,
) -> String {
    let lang_instruction = match lang {
        Language::Japanese => "回答は日本語で記述してください。",
        Language::English => "Please respond in English.",
    };

    let chunk_info = if total_chunks > 1 {
        format!("\n\nNote: This is chunk {chunk_index} of {total_chunks}. Summarize only this chunk's changes.")
    } else {
        String::new()
    };

    format!(
        r#"You are a code reviewer. Summarize the following pull request changes.

{lang_instruction}

## PR Information
- Title: {title}
- Description: {body}

## Diff
```
{diff}
```
{chunk_info}

## Instructions
- Describe what this PR changes at a high level
- List the key modifications by file or component
- Note any potential risks or concerns
- Keep the summary concise and actionable"#,
        title = metadata.title,
        body = if metadata.body.is_empty() {
            "(no description)"
        } else {
            &metadata.body
        },
        diff = diff_chunk,
    )
}

fn consistency_template(
    metadata: &PrMetadata,
    diff_chunk: &str,
    lang: Language,
    chunk_index: usize,
    total_chunks: usize,
) -> String {
    let lang_instruction = match lang {
        Language::Japanese => "回答は日本語で記述してください。",
        Language::English => "Please respond in English.",
    };

    let chunk_info = if total_chunks > 1 {
        format!("\n\nNote: This is chunk {chunk_index} of {total_chunks}. Analyze only this chunk's changes.")
    } else {
        String::new()
    };

    format!(
        r#"You are a code reviewer. Check whether the PR title and description accurately reflect the actual code changes.

{lang_instruction}

## PR Information
- Title: {title}
- Description: {body}

## Diff
```
{diff}
```
{chunk_info}

## Instructions
- Compare the PR title/description with the actual changes
- Identify any discrepancies between what the PR claims to do and what it actually does
- Flag any undocumented changes (changes not mentioned in the title or description)
- Rate the consistency: High, Medium, or Low
- Provide specific examples of any inconsistencies found"#,
        title = metadata.title,
        body = if metadata.body.is_empty() {
            "(no description)"
        } else {
            &metadata.body
        },
        diff = diff_chunk,
    )
}

fn impact_analysis_template(
    metadata: &PrMetadata,
    diff_chunk: &str,
    lang: Language,
    chunk_index: usize,
    total_chunks: usize,
) -> String {
    let lang_instruction = match lang {
        Language::Japanese => "回答は日本語で記述してください。",
        Language::English => "Please respond in English.",
    };

    let chunk_info = if total_chunks > 1 {
        format!("\n\nNote: This is chunk {chunk_index} of {total_chunks}. Analyze only this chunk's changes.")
    } else {
        String::new()
    };

    format!(
        r#"You are an expert code reviewer analyzing the impact and risk of code changes.

{lang_instruction}

## PR Information
- Title: {title}
- Description: {body}

## Diff
```
{diff}
```
{chunk_info}

## Instructions

Analyze the changes and respond with the following sections:

### 要約
Provide a brief summary of what these changes do.

### 影響モジュール
List modules/components affected by these changes. Use format:
- module_name: description of impact

### 破壊的変更
List any breaking changes. Use format:
- `file/path.rs` description of breaking change (重大 if critical)
If none, write: - なし

### リスク
List risk factors and concerns. Use format:
- description of risk
If none, write: - なし

### リスクレベル: [Low/Medium/High]
Provide the overall risk level.

Consider these factors:
- Public API changes (function signatures, struct fields, trait implementations)
- Database schema changes
- Configuration format changes
- Dependency version changes
- Security-sensitive code modifications
- Error handling changes that could affect callers
- Behavioral changes in existing functions"#,
        title = metadata.title,
        body = if metadata.body.is_empty() {
            "(no description)"
        } else {
            &metadata.body
        },
        diff = diff_chunk,
    )
}

fn file_summary_template(diff: &FileDiff, diff_text: &str, lang: Language) -> String {
    let lang_instruction = match lang {
        Language::Japanese => "回答は日本語で記述してください。",
        Language::English => "Please respond in English.",
    };

    let path = diff
        .new_path
        .as_deref()
        .or(diff.old_path.as_deref())
        .unwrap_or("(unknown)");

    format!(
        r#"You are a code reviewer. Summarize the changes to the following file.

{lang_instruction}

## File: {path}

## Diff
```
{diff_text}
```

## Instructions
- Describe what changed in this file
- Note any potential issues or improvements
- Keep the summary to 2-3 sentences"#,
    )
}

// ── 差分フォーマット ────────────────────────────────────────────────

/// FileDiff のリストをテキスト形式に変換する
fn format_diffs(diffs: &[FileDiff]) -> String {
    diffs
        .iter()
        .map(format_single_diff)
        .collect::<Vec<_>>()
        .join("\n")
}

/// 単一の FileDiff をテキスト形式に変換する
fn format_single_diff(diff: &FileDiff) -> String {
    let old = diff.old_path.as_deref().unwrap_or("/dev/null");
    let new = diff.new_path.as_deref().unwrap_or("/dev/null");

    let mut out = format!("--- {old}\n+++ {new}\n");

    for chunk in &diff.chunks {
        out.push_str(&chunk.header);
        out.push('\n');
        for line in &chunk.lines {
            let prefix = match line.origin {
                LineOrigin::Addition => '+',
                LineOrigin::Deletion => '-',
                LineOrigin::Context => ' ',
                LineOrigin::Other(_) => ' ',
            };
            out.push(prefix);
            out.push_str(&line.content);
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::diff::{DiffChunk, DiffLineInfo, FileStatus};

    fn make_metadata() -> PrMetadata {
        PrMetadata {
            title: "feat: add new feature".to_string(),
            body: "This PR adds a new feature for processing data.".to_string(),
        }
    }

    fn make_diff_line(origin: LineOrigin, content: &str) -> DiffLineInfo {
        DiffLineInfo {
            origin,
            old_lineno: None,
            new_lineno: None,
            content: content.to_string(),
        }
    }

    fn make_file_diff(path: &str, additions: usize, deletions: usize) -> FileDiff {
        let mut lines = Vec::new();
        for i in 0..additions {
            lines.push(make_diff_line(
                LineOrigin::Addition,
                &format!("added line {i}\n"),
            ));
        }
        for i in 0..deletions {
            lines.push(make_diff_line(
                LineOrigin::Deletion,
                &format!("removed line {i}\n"),
            ));
        }

        FileDiff {
            old_path: Some(path.to_string()),
            new_path: Some(path.to_string()),
            status: FileStatus::Modified,
            chunks: vec![DiffChunk {
                header: "@@ -1,1 +1,1 @@".to_string(),
                lines,
            }],
        }
    }

    #[test]
    fn test_summary_prompt_contains_metadata() {
        let builder = PromptBuilder::default();
        let diffs = vec![make_file_diff("src/main.rs", 3, 1)];
        let metadata = make_metadata();
        let prompts = builder.build_summary_prompt(&diffs, &metadata, Language::Japanese);

        assert_eq!(prompts.len(), 1);
        assert!(prompts[0].contains("feat: add new feature"));
        assert!(prompts[0].contains("This PR adds a new feature"));
        assert!(prompts[0].contains("日本語"));
    }

    #[test]
    fn test_summary_prompt_english() {
        let builder = PromptBuilder::default();
        let diffs = vec![make_file_diff("src/main.rs", 2, 0)];
        let metadata = make_metadata();
        let prompts = builder.build_summary_prompt(&diffs, &metadata, Language::English);

        assert_eq!(prompts.len(), 1);
        assert!(prompts[0].contains("Please respond in English"));
        assert!(!prompts[0].contains("日本語"));
    }

    #[test]
    fn test_consistency_prompt_contains_metadata() {
        let builder = PromptBuilder::default();
        let diffs = vec![make_file_diff("src/lib.rs", 5, 2)];
        let metadata = make_metadata();
        let prompts = builder.build_consistency_prompt(&diffs, &metadata, Language::Japanese);

        assert_eq!(prompts.len(), 1);
        assert!(prompts[0].contains("feat: add new feature"));
        assert!(prompts[0].contains("consistency"));
        assert!(prompts[0].contains("日本語"));
    }

    #[test]
    fn test_consistency_prompt_english() {
        let builder = PromptBuilder::default();
        let diffs = vec![make_file_diff("src/lib.rs", 2, 0)];
        let metadata = make_metadata();
        let prompts = builder.build_consistency_prompt(&diffs, &metadata, Language::English);

        assert_eq!(prompts.len(), 1);
        assert!(prompts[0].contains("Please respond in English"));
    }

    #[test]
    fn test_file_summary_prompt() {
        let builder = PromptBuilder::default();
        let diff = make_file_diff("src/main.rs", 3, 1);
        let prompt = builder.build_file_summary_prompt(&diff, Language::Japanese);

        assert!(prompt.contains("src/main.rs"));
        assert!(prompt.contains("日本語"));
        assert!(prompt.contains("Summarize the changes"));
    }

    #[test]
    fn test_file_summary_prompt_english() {
        let builder = PromptBuilder::default();
        let diff = make_file_diff("src/main.rs", 2, 0);
        let prompt = builder.build_file_summary_prompt(&diff, Language::English);

        assert!(prompt.contains("src/main.rs"));
        assert!(prompt.contains("Please respond in English"));
    }

    #[test]
    fn test_empty_body_shows_no_description() {
        let builder = PromptBuilder::default();
        let diffs = vec![make_file_diff("src/main.rs", 1, 0)];
        let metadata = PrMetadata {
            title: "fix: something".to_string(),
            body: String::new(),
        };
        let prompts = builder.build_summary_prompt(&diffs, &metadata, Language::English);

        assert!(prompts[0].contains("(no description)"));
    }

    #[test]
    fn test_chunk_splitting_small_diff() {
        let builder = PromptBuilder::default();
        let diffs = vec![make_file_diff("src/main.rs", 3, 1)];
        let metadata = make_metadata();
        let prompts = builder.build_summary_prompt(&diffs, &metadata, Language::English);

        // 小さい差分はチャンク分割されない
        assert_eq!(prompts.len(), 1);
        assert!(!prompts[0].contains("chunk"));
    }

    #[test]
    fn test_chunk_splitting_large_diff() {
        // max_chars を小さくして分割を強制する
        let builder = PromptBuilder::with_max_chars(200);

        // 大きな差分を作成
        let diffs: Vec<FileDiff> = (0..10)
            .map(|i| make_file_diff(&format!("src/module{i}.rs"), 20, 10))
            .collect();
        let metadata = make_metadata();
        let prompts = builder.build_summary_prompt(&diffs, &metadata, Language::English);

        // 複数チャンクに分割される
        assert!(prompts.len() > 1);
        // 各チャンクにチャンク情報が含まれる
        for prompt in &prompts {
            assert!(prompt.contains("chunk"));
        }
    }

    #[test]
    fn test_chunk_splitting_consistency_prompt() {
        let builder = PromptBuilder::with_max_chars(200);
        let diffs: Vec<FileDiff> = (0..10)
            .map(|i| make_file_diff(&format!("src/mod{i}.rs"), 20, 10))
            .collect();
        let metadata = make_metadata();
        let prompts = builder.build_consistency_prompt(&diffs, &metadata, Language::English);

        assert!(prompts.len() > 1);
    }

    #[test]
    fn test_format_diffs_includes_paths() {
        let diffs = vec![
            make_file_diff("src/main.rs", 2, 1),
            make_file_diff("src/lib.rs", 1, 0),
        ];
        let text = format_diffs(&diffs);

        assert!(text.contains("--- src/main.rs"));
        assert!(text.contains("+++ src/main.rs"));
        assert!(text.contains("--- src/lib.rs"));
        assert!(text.contains("+++ src/lib.rs"));
    }

    #[test]
    fn test_format_diffs_includes_line_content() {
        let diffs = vec![make_file_diff("src/main.rs", 2, 1)];
        let text = format_diffs(&diffs);

        assert!(text.contains("+added line 0"));
        assert!(text.contains("+added line 1"));
        assert!(text.contains("-removed line 0"));
    }

    #[test]
    fn test_format_single_diff_added_file() {
        let diff = FileDiff {
            old_path: None,
            new_path: Some("src/new.rs".to_string()),
            status: FileStatus::Added,
            chunks: vec![DiffChunk {
                header: "@@ -0,0 +1,2 @@".to_string(),
                lines: vec![
                    make_diff_line(LineOrigin::Addition, "line 1\n"),
                    make_diff_line(LineOrigin::Addition, "line 2\n"),
                ],
            }],
        };
        let text = format_single_diff(&diff);

        assert!(text.contains("--- /dev/null"));
        assert!(text.contains("+++ src/new.rs"));
    }

    #[test]
    fn test_format_single_diff_deleted_file() {
        let diff = FileDiff {
            old_path: Some("src/old.rs".to_string()),
            new_path: None,
            status: FileStatus::Deleted,
            chunks: vec![DiffChunk {
                header: "@@ -1,2 +0,0 @@".to_string(),
                lines: vec![
                    make_diff_line(LineOrigin::Deletion, "line 1\n"),
                    make_diff_line(LineOrigin::Deletion, "line 2\n"),
                ],
            }],
        };
        let text = format_single_diff(&diff);

        assert!(text.contains("--- src/old.rs"));
        assert!(text.contains("+++ /dev/null"));
    }

    #[test]
    fn test_empty_diffs_produces_empty_text() {
        let text = format_diffs(&[]);
        assert!(text.is_empty());
    }

    #[test]
    fn test_force_split_respects_max_chars() {
        let text = (0..100)
            .map(|i| format!("line {i}: some content here"))
            .collect::<Vec<_>>()
            .join("\n");
        let chunks = force_split(&text, 200);

        for chunk in &chunks {
            // 各チャンクは max_chars + 1行分 以下（行単位の分割のため多少超えうる）
            assert!(
                chunk.len() <= 200 + 50,
                "chunk length {} exceeds limit",
                chunk.len()
            );
        }
        assert!(chunks.len() > 1);
    }

    #[test]
    fn test_split_into_chunks_preserves_content() {
        let builder = PromptBuilder::with_max_chars(100);
        let diffs: Vec<FileDiff> = (0..5)
            .map(|i| make_file_diff(&format!("src/file{i}.rs"), 5, 2))
            .collect();
        let full_text = format_diffs(&diffs);
        let chunks = builder.split_into_chunks(&full_text);

        // 分割後のチャンクを結合すると元のテキストが含まれる
        let rejoined = chunks.join("\n");
        // 各ファイルの diff ヘッダーが含まれていることを確認
        for i in 0..5 {
            assert!(
                rejoined.contains(&format!("src/file{i}.rs")),
                "missing file{i}.rs in rejoined chunks"
            );
        }
    }

    #[test]
    fn test_no_splitting_when_within_limit() {
        let builder = PromptBuilder::with_max_chars(100_000);
        let diffs = vec![make_file_diff("src/main.rs", 5, 2)];
        let full_text = format_diffs(&diffs);
        let chunks = builder.split_into_chunks(&full_text);

        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], full_text);
    }

    #[test]
    fn test_impact_analysis_prompt_contains_metadata() {
        let builder = PromptBuilder::default();
        let diffs = vec![make_file_diff("src/main.rs", 3, 1)];
        let metadata = make_metadata();
        let prompts = builder.build_impact_analysis_prompt(&diffs, &metadata, Language::Japanese);

        assert_eq!(prompts.len(), 1);
        assert!(prompts[0].contains("feat: add new feature"));
        assert!(prompts[0].contains("This PR adds a new feature"));
        assert!(prompts[0].contains("日本語"));
        assert!(prompts[0].contains("影響モジュール"));
        assert!(prompts[0].contains("破壊的変更"));
        assert!(prompts[0].contains("リスクレベル"));
    }

    #[test]
    fn test_impact_analysis_prompt_english() {
        let builder = PromptBuilder::default();
        let diffs = vec![make_file_diff("src/main.rs", 2, 0)];
        let metadata = make_metadata();
        let prompts = builder.build_impact_analysis_prompt(&diffs, &metadata, Language::English);

        assert_eq!(prompts.len(), 1);
        assert!(prompts[0].contains("Please respond in English"));
        assert!(prompts[0].contains("breaking change"));
    }

    #[test]
    fn test_impact_analysis_prompt_chunking() {
        let builder = PromptBuilder::with_max_chars(200);
        let diffs: Vec<FileDiff> = (0..10)
            .map(|i| make_file_diff(&format!("src/module{i}.rs"), 20, 10))
            .collect();
        let metadata = make_metadata();
        let prompts = builder.build_impact_analysis_prompt(&diffs, &metadata, Language::Japanese);

        assert!(prompts.len() > 1);
        for prompt in &prompts {
            assert!(prompt.contains("chunk"));
        }
    }
}
