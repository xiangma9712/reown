use crate::git::diff::{FileDiff, LineOrigin};

/// 変更種別の分類
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub enum ChangeCategory {
    /// ロジック変更（ソースコードの実質的な変更）
    Logic,
    /// リファクタリング（動作変更なし）
    Refactor,
    /// テストの追加・更新
    Test,
    /// 設定ファイルの変更
    Config,
    /// ドキュメントの変更
    Documentation,
    /// CI/CD の変更
    CI,
    /// 依存関係の変更
    Dependency,
    /// その他
    Other,
}

/// ファイルの変更種別を判定する。
///
/// ファイルパスと拡張子、変更内容のパターンマッチで判定する。
pub fn classify_file_change(diff: &FileDiff) -> ChangeCategory {
    let path = effective_path(diff);

    // テストファイルの判定（パスベース）
    if is_test_file(path) {
        return ChangeCategory::Test;
    }

    // CI/CD ファイルの判定
    if is_ci_file(path) {
        return ChangeCategory::CI;
    }

    // ドキュメントファイルの判定
    if is_doc_file(path) {
        return ChangeCategory::Documentation;
    }

    // 依存関係ファイルの判定（設定ファイルより先に判定、Cargo.toml等は依存関係として扱う）
    if is_dependency_file(path) {
        return ChangeCategory::Dependency;
    }

    // 設定ファイルの判定
    if is_config_file(path) {
        return ChangeCategory::Config;
    }

    // ソースコードの場合、変更内容からリファクタかロジック変更かを判定
    if is_source_file(path) {
        return classify_source_change(diff);
    }

    ChangeCategory::Other
}

pub(crate) fn effective_path(diff: &FileDiff) -> &str {
    diff.new_path
        .as_deref()
        .or(diff.old_path.as_deref())
        .unwrap_or("")
}

fn is_test_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    // ファイル名パターン
    lower.contains("test")
        || lower.contains("spec")
        || lower.contains("__tests__")
        || lower.ends_with(".test.ts")
        || lower.ends_with(".test.tsx")
        || lower.ends_with(".test.js")
        || lower.ends_with(".test.jsx")
        || lower.ends_with(".spec.ts")
        || lower.ends_with(".spec.tsx")
        || lower.ends_with(".spec.js")
        || lower.ends_with(".spec.jsx")
        // Rust テストユーティリティ
        || lower.contains("test_utils")
}

fn is_ci_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.starts_with(".github/")
        || lower.starts_with(".circleci/")
        || lower.starts_with(".gitlab-ci")
        || lower == "jenkinsfile"
        || lower.starts_with(".travis")
        || lower == "bitbucket-pipelines.yml"
}

fn is_doc_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    let ext = file_extension(&lower);
    ext == "md" || ext == "txt" || ext == "rst" || ext == "adoc"
        || lower.starts_with("docs/")
        || lower.starts_with("doc/")
        || lower == "license"
        || lower == "licence"
        || lower == "changelog"
}

fn is_config_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    let ext = file_extension(&lower);
    let filename = file_name(&lower);

    // 設定系拡張子
    ext == "toml" || ext == "yaml" || ext == "yml" || ext == "ini" || ext == "conf"
        // 特定の設定ファイル
        || filename.starts_with('.')
        || lower == "tauri.conf.json"
        || lower.ends_with(".config.js")
        || lower.ends_with(".config.ts")
        || lower.ends_with(".config.mjs")
        || lower == "tsconfig.json"
        || lower == "vite.config.ts"
        || lower == "tailwind.config.js"
        || lower == "tailwind.config.ts"
}

fn is_dependency_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    let filename = file_name(&lower);
    filename == "cargo.toml"
        || filename == "cargo.lock"
        || filename == "package.json"
        || filename == "package-lock.json"
        || filename == "yarn.lock"
        || filename == "pnpm-lock.yaml"
        || filename == "go.mod"
        || filename == "go.sum"
        || filename == "gemfile"
        || filename == "gemfile.lock"
        || filename == "requirements.txt"
        || filename == "poetry.lock"
        || filename == "pyproject.toml"
}

fn is_source_file(path: &str) -> bool {
    let ext = file_extension(path);
    matches!(
        ext,
        "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "go" | "java"
            | "c" | "cpp" | "h" | "hpp" | "cs" | "rb" | "swift" | "kt"
    )
}

/// ソースコードの変更がリファクタかロジック変更かをヒューリスティクスで判定する。
///
/// 追加行数と削除行数が近い場合（差が少ない場合）リファクタとみなす。
fn classify_source_change(diff: &FileDiff) -> ChangeCategory {
    let (additions, deletions) = count_changes(diff);

    // 変更がない場合（パーミッション変更など）
    if additions == 0 && deletions == 0 {
        return ChangeCategory::Other;
    }

    // 追加のみ → ロジック変更（新規コード追加）
    if deletions == 0 {
        return ChangeCategory::Logic;
    }

    // 削除のみ → ロジック変更（コード削除）
    if additions == 0 {
        return ChangeCategory::Logic;
    }

    // 追加行数と削除行数が近い場合はリファクタの可能性が高い
    let ratio = additions as f64 / deletions as f64;
    if (0.8..=1.2).contains(&ratio) {
        return ChangeCategory::Refactor;
    }

    ChangeCategory::Logic
}

pub(crate) fn count_changes(diff: &FileDiff) -> (usize, usize) {
    let mut additions = 0;
    let mut deletions = 0;
    for chunk in &diff.chunks {
        for line in &chunk.lines {
            match line.origin {
                LineOrigin::Addition => additions += 1,
                LineOrigin::Deletion => deletions += 1,
                _ => {}
            }
        }
    }
    (additions, deletions)
}

fn file_extension(path: &str) -> &str {
    path.rsplit('.').next().unwrap_or("")
}

fn file_name(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::diff::{DiffChunk, DiffLineInfo, FileStatus};

    fn make_diff(path: &str, status: FileStatus, additions: usize, deletions: usize) -> FileDiff {
        let mut lines = Vec::new();
        for _ in 0..additions {
            lines.push(DiffLineInfo {
                origin: LineOrigin::Addition,
                old_lineno: None,
                new_lineno: Some(1),
                content: "added line\n".to_string(),
            });
        }
        for _ in 0..deletions {
            lines.push(DiffLineInfo {
                origin: LineOrigin::Deletion,
                old_lineno: Some(1),
                new_lineno: None,
                content: "removed line\n".to_string(),
            });
        }

        FileDiff {
            old_path: Some(path.to_string()),
            new_path: Some(path.to_string()),
            status,
            chunks: vec![DiffChunk {
                header: "@@ -1,1 +1,1 @@".to_string(),
                lines,
            }],
        }
    }

    #[test]
    fn test_classify_test_file() {
        let diff = make_diff("src/tests/my_test.rs", FileStatus::Modified, 5, 3);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Test);
    }

    #[test]
    fn test_classify_spec_file() {
        let diff = make_diff("src/components/App.spec.tsx", FileStatus::Modified, 10, 2);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Test);
    }

    #[test]
    fn test_classify_ci_file() {
        let diff = make_diff(".github/workflows/ci.yml", FileStatus::Modified, 3, 1);
        assert_eq!(classify_file_change(&diff), ChangeCategory::CI);
    }

    #[test]
    fn test_classify_doc_file() {
        let diff = make_diff("README.md", FileStatus::Modified, 10, 5);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Documentation);
    }

    #[test]
    fn test_classify_docs_directory() {
        let diff = make_diff("docs/architecture.md", FileStatus::Added, 50, 0);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Documentation);
    }

    #[test]
    fn test_classify_config_toml() {
        let diff = make_diff("config/settings.toml", FileStatus::Modified, 2, 1);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Config);
    }

    #[test]
    fn test_classify_config_dotfile() {
        let diff = make_diff(".eslintrc", FileStatus::Modified, 5, 3);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Config);
    }

    #[test]
    fn test_classify_dependency_cargo_toml() {
        let diff = make_diff("Cargo.toml", FileStatus::Modified, 1, 1);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Dependency);
    }

    #[test]
    fn test_classify_dependency_package_json() {
        let diff = make_diff("package.json", FileStatus::Modified, 3, 1);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Dependency);
    }

    #[test]
    fn test_classify_logic_change_addition_only() {
        let diff = make_diff("src/main.rs", FileStatus::Modified, 20, 0);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Logic);
    }

    #[test]
    fn test_classify_logic_change_deletion_only() {
        let diff = make_diff("src/main.rs", FileStatus::Modified, 0, 15);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Logic);
    }

    #[test]
    fn test_classify_refactor_balanced_changes() {
        // 追加10行、削除10行 → ratio=1.0 → リファクタ
        let diff = make_diff("src/lib.rs", FileStatus::Modified, 10, 10);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Refactor);
    }

    #[test]
    fn test_classify_logic_unbalanced_changes() {
        // 追加20行、削除5行 → ratio=4.0 → ロジック変更
        let diff = make_diff("src/lib.rs", FileStatus::Modified, 20, 5);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Logic);
    }

    #[test]
    fn test_classify_other_unknown_file() {
        let diff = make_diff("image.png", FileStatus::Added, 0, 0);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Other);
    }

    #[test]
    fn test_classify_uses_new_path_for_renamed() {
        let diff = FileDiff {
            old_path: Some("old_test.rs".to_string()),
            new_path: Some("src/new_module.rs".to_string()),
            status: FileStatus::Renamed,
            chunks: vec![DiffChunk {
                header: "@@ -1,1 +1,1 @@".to_string(),
                lines: vec![
                    DiffLineInfo {
                        origin: LineOrigin::Addition,
                        old_lineno: None,
                        new_lineno: Some(1),
                        content: "new\n".to_string(),
                    },
                    DiffLineInfo {
                        origin: LineOrigin::Deletion,
                        old_lineno: Some(1),
                        new_lineno: None,
                        content: "old\n".to_string(),
                    },
                ],
            }],
        };
        // new_path は src/new_module.rs でテストファイルではないのでリファクタ
        assert_eq!(classify_file_change(&diff), ChangeCategory::Refactor);
    }

    #[test]
    fn test_classify_lock_file() {
        let diff = make_diff("package-lock.json", FileStatus::Modified, 100, 50);
        assert_eq!(classify_file_change(&diff), ChangeCategory::Dependency);
    }
}
