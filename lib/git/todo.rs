use anyhow::{Context, Result};
use serde::Serialize;
use std::fs;
use std::path::Path;

/// TODO/FIXMEコメントの種別
#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum TodoKind {
    Todo,
    Fixme,
}

/// リポジトリ内のTODO/FIXMEコメント
#[derive(Debug, Clone, Serialize)]
pub struct TodoItem {
    /// ファイルパス（リポジトリルートからの相対パス）
    pub file_path: String,
    /// 行番号（1始まり）
    pub line_number: usize,
    /// 種別（TODO/FIXME）
    pub kind: TodoKind,
    /// コメント内容
    pub content: String,
}

/// 指定ディレクトリ配下のファイルからTODO/FIXMEコメントを抽出する
///
/// .gitignoreに該当するファイルはスキップする。
/// バイナリファイルもスキップする。
pub fn extract_todos(repo_path: &str) -> Result<Vec<TodoItem>> {
    let repo = super::open_repo(repo_path)?;
    let workdir = repo
        .workdir()
        .with_context(|| "ベアリポジトリはサポートされていません")?;

    let mut items = Vec::new();
    walk_directory(&repo, workdir, workdir, &mut items)?;
    items.sort_by(|a, b| a.file_path.cmp(&b.file_path).then(a.line_number.cmp(&b.line_number)));
    Ok(items)
}

/// ディレクトリを再帰的に走査し、TODO/FIXMEコメントを抽出する
fn walk_directory(
    repo: &git2::Repository,
    root: &Path,
    dir: &Path,
    items: &mut Vec<TodoItem>,
) -> Result<()> {
    let entries = fs::read_dir(dir)
        .with_context(|| format!("ディレクトリの読み取りに失敗: {}", dir.display()))?;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();

        // .gitディレクトリをスキップ
        if path.file_name().map(|n| n == ".git").unwrap_or(false) {
            continue;
        }

        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path);

        // .gitignoreによるフィルタリング
        if repo.status_should_ignore(relative).unwrap_or(false) {
            continue;
        }

        if path.is_dir() {
            walk_directory(repo, root, &path, items)?;
        } else if path.is_file() {
            scan_file(relative, &path, items)?;
        }
    }

    Ok(())
}

/// ファイル内のTODO/FIXMEコメントを抽出する
fn scan_file(relative_path: &Path, absolute_path: &Path, items: &mut Vec<TodoItem>) -> Result<()> {
    // バイナリファイルをスキップ（読み込み失敗もスキップ）
    let content = match fs::read(absolute_path) {
        Ok(bytes) => {
            if is_binary(&bytes) {
                return Ok(());
            }
            String::from_utf8_lossy(&bytes).into_owned()
        }
        Err(_) => return Ok(()),
    };

    let file_path_str = relative_path.to_string_lossy().to_string();

    for (line_idx, line) in content.lines().enumerate() {
        if let Some(item) = parse_todo_line(line, &file_path_str, line_idx + 1) {
            items.push(item);
        }
    }

    Ok(())
}

/// 行からTODO/FIXMEを検出してTodoItemを返す
fn parse_todo_line(line: &str, file_path: &str, line_number: usize) -> Option<TodoItem> {
    // TODO: や FIXME: のパターンを検出
    // 大文字小文字を区別しない（todo, fixme なども検出する）
    // 単語境界をチェックし、変数名や文字列中の偽陽性を防ぐ
    let upper = line.to_uppercase();

    for (keyword, kind) in [("TODO", TodoKind::Todo), ("FIXME", TodoKind::Fixme)] {
        let mut search_from = 0;
        while let Some(rel_pos) = upper[search_from..].find(keyword) {
            let pos = search_from + rel_pos;

            // 前の文字が英数字またはアンダースコアならスキップ（単語の一部）
            let before_ok = pos == 0
                || !line.as_bytes()[pos - 1].is_ascii_alphanumeric()
                    && line.as_bytes()[pos - 1] != b'_';

            // 後の文字が英数字またはアンダースコアならスキップ（単語の一部）
            let end = pos + keyword.len();
            let after_ok = end >= line.len()
                || !line.as_bytes()[end].is_ascii_alphanumeric()
                    && line.as_bytes()[end] != b'_';

            if before_ok && after_ok {
                // キーワード後の内容を抽出
                let after_keyword = &line[end..];
                let content = after_keyword
                    .trim_start_matches([':', ' ', '(', ')'])
                    .trim()
                    .to_string();

                return Some(TodoItem {
                    file_path: file_path.to_string(),
                    line_number,
                    kind,
                    content,
                });
            }

            search_from = pos + keyword.len();
        }
    }

    None
}

/// バイナリファイルかどうかを判定する
fn is_binary(bytes: &[u8]) -> bool {
    let check_len = bytes.len().min(8192);
    bytes[..check_len].contains(&0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_utils::init_test_repo;
    use std::fs;


    #[test]
    fn test_parse_todo_line_todo() {
        let item = parse_todo_line("// TODO: fix this", "test.rs", 1).unwrap();
        assert_eq!(item.kind, TodoKind::Todo);
        assert_eq!(item.content, "fix this");
        assert_eq!(item.line_number, 1);
    }

    #[test]
    fn test_parse_todo_line_fixme() {
        let item = parse_todo_line("# FIXME: broken code", "test.py", 5).unwrap();
        assert_eq!(item.kind, TodoKind::Fixme);
        assert_eq!(item.content, "broken code");
        assert_eq!(item.line_number, 5);
    }

    #[test]
    fn test_parse_todo_line_no_match() {
        assert!(parse_todo_line("regular code here", "test.rs", 1).is_none());
    }

    #[test]
    fn test_parse_todo_line_case_insensitive() {
        let item = parse_todo_line("// todo: lowercase", "test.rs", 1).unwrap();
        assert_eq!(item.kind, TodoKind::Todo);
        assert_eq!(item.content, "lowercase");
    }

    #[test]
    fn test_parse_todo_line_without_colon() {
        let item = parse_todo_line("// TODO fix without colon", "test.rs", 1).unwrap();
        assert_eq!(item.kind, TodoKind::Todo);
        assert_eq!(item.content, "fix without colon");
    }

    #[test]
    fn test_parse_todo_line_ignores_variable_names() {
        // 変数名に含まれるTODO/FIXMEは検出しない
        assert!(parse_todo_line("let is_todo_done = true;", "test.rs", 1).is_none());
        assert!(parse_todo_line("let fixme_later = false;", "test.rs", 1).is_none());
        assert!(parse_todo_line("fn handle_todo_item()", "test.rs", 1).is_none());
    }

    #[test]
    fn test_parse_todo_line_ignores_partial_words() {
        // 単語の一部としてのTODO/FIXMEは検出しない
        assert!(parse_todo_line("let mytodo = 1;", "test.rs", 1).is_none());
        assert!(parse_todo_line("TODOS.push(item);", "test.rs", 1).is_none());
    }

    #[test]
    fn test_is_binary() {
        assert!(is_binary(&[0x00, 0x01, 0x02]));
        assert!(!is_binary(b"hello world"));
    }

    #[test]
    fn test_extract_todos_basic() {
        let (dir, _repo) = init_test_repo();

        // TODOコメントを含むファイルを作成
        fs::write(
            dir.path().join("main.rs"),
            "fn main() {\n    // TODO: implement this\n    // FIXME: bug here\n}\n",
        )
        .unwrap();

        let items = extract_todos(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].kind, TodoKind::Todo);
        assert_eq!(items[0].content, "implement this");
        assert_eq!(items[0].line_number, 2);
        assert_eq!(items[1].kind, TodoKind::Fixme);
        assert_eq!(items[1].content, "bug here");
        assert_eq!(items[1].line_number, 3);
    }

    #[test]
    fn test_extract_todos_respects_gitignore() {
        let (dir, _repo) = init_test_repo();

        // .gitignore を作成
        fs::write(dir.path().join(".gitignore"), "ignored_dir/\n").unwrap();

        // 無視されるディレクトリ内にTODOを含むファイルを作成
        fs::create_dir(dir.path().join("ignored_dir")).unwrap();
        fs::write(
            dir.path().join("ignored_dir").join("test.rs"),
            "// TODO: should be ignored\n",
        )
        .unwrap();

        // 無視されないファイルにTODOを作成
        fs::write(
            dir.path().join("visible.rs"),
            "// TODO: should be visible\n",
        )
        .unwrap();

        let items = extract_todos(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].file_path, "visible.rs");
    }

    #[test]
    fn test_extract_todos_skips_binary() {
        let (dir, _repo) = init_test_repo();

        // バイナリファイルを作成
        fs::write(dir.path().join("binary.bin"), [0x00, 0x01, 0x02, 0x03]).unwrap();

        // テキストファイルを作成
        fs::write(dir.path().join("text.rs"), "// TODO: find me\n").unwrap();

        let items = extract_todos(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].file_path, "text.rs");
    }

    #[test]
    fn test_extract_todos_empty_repo() {
        let (dir, _repo) = init_test_repo();
        let items = extract_todos(dir.path().to_str().unwrap()).unwrap();
        assert!(items.is_empty());
    }

    #[test]
    fn test_extract_todos_multiple_files() {
        let (dir, _repo) = init_test_repo();

        fs::create_dir(dir.path().join("src")).unwrap();
        fs::write(
            dir.path().join("src").join("a.rs"),
            "// TODO: task A\n",
        )
        .unwrap();
        fs::write(
            dir.path().join("src").join("b.rs"),
            "// FIXME: bug B\n",
        )
        .unwrap();

        let items = extract_todos(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(items.len(), 2);
        // ファイルパスでソートされている
        assert!(items[0].file_path.contains("a.rs"));
        assert!(items[1].file_path.contains("b.rs"));
    }

    #[test]
    fn test_todo_item_serializes() {
        let item = TodoItem {
            file_path: "src/main.rs".to_string(),
            line_number: 42,
            kind: TodoKind::Todo,
            content: "implement feature".to_string(),
        };
        let json = serde_json::to_value(&item).unwrap();
        assert_eq!(json["file_path"], "src/main.rs");
        assert_eq!(json["line_number"], 42);
        assert_eq!(json["kind"], "Todo");
        assert_eq!(json["content"], "implement feature");
    }
}
