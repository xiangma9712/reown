use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// 登録済みリポジトリの情報
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RepositoryEntry {
    /// リポジトリの表示名（ディレクトリ名から自動生成）
    pub name: String,
    /// リポジトリのパス
    pub path: String,
}

/// 指定パスが有効な Git リポジトリかどうかを検証し、RepositoryEntry を返す
pub fn validate_repository(path: &str) -> Result<RepositoryEntry> {
    let repo_path = Path::new(path);
    anyhow::ensure!(repo_path.exists(), "ディレクトリが存在しません: {path}");

    // git2 で有効なリポジトリかどうかを検証
    git2::Repository::discover(path)
        .with_context(|| format!("有効な Git リポジトリではありません: {path}"))?;

    let name = repo_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());

    Ok(RepositoryEntry {
        name,
        path: path.to_string(),
    })
}

/// リポジトリ一覧を JSON ファイルから読み込む
pub fn load_repositories(storage_path: &Path) -> Result<Vec<RepositoryEntry>> {
    if !storage_path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(storage_path)
        .with_context(|| format!("リポジトリ一覧の読み込みに失敗: {}", storage_path.display()))?;

    let repos: Vec<RepositoryEntry> =
        serde_json::from_str(&content).with_context(|| "リポジトリ一覧の JSON パースに失敗")?;

    Ok(repos)
}

/// リポジトリ一覧を JSON ファイルに保存する
pub fn save_repositories(storage_path: &Path, repos: &[RepositoryEntry]) -> Result<()> {
    if let Some(parent) = storage_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("ディレクトリの作成に失敗: {}", parent.display()))?;
    }

    let content = serde_json::to_string_pretty(repos)
        .with_context(|| "リポジトリ一覧の JSON シリアライズに失敗")?;

    std::fs::write(storage_path, content)
        .with_context(|| format!("リポジトリ一覧の保存に失敗: {}", storage_path.display()))?;

    Ok(())
}

/// リポジトリを追加する。すでに同じパスが登録されていればエラーを返す。
pub fn add_repository(storage_path: &Path, path: &str) -> Result<RepositoryEntry> {
    let entry = validate_repository(path)?;

    let mut repos = load_repositories(storage_path)?;

    if repos.iter().any(|r| r.path == entry.path) {
        anyhow::bail!("リポジトリはすでに登録されています: {path}");
    }

    repos.push(entry.clone());
    save_repositories(storage_path, &repos)?;

    Ok(entry)
}

/// リポジトリを削除する
pub fn remove_repository(storage_path: &Path, path: &str) -> Result<()> {
    let mut repos = load_repositories(storage_path)?;
    let original_len = repos.len();
    repos.retain(|r| r.path != path);

    if repos.len() == original_len {
        anyhow::bail!("リポジトリが見つかりません: {path}");
    }

    save_repositories(storage_path, &repos)?;
    Ok(())
}

/// ストレージファイルのデフォルトパスを返す
pub fn default_storage_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("repositories.json")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_git_repo(dir: &Path) {
        git2::Repository::init(dir).expect("Failed to init git repo");
    }

    #[test]
    fn test_validate_repository_valid() {
        let tmp = TempDir::new().unwrap();
        create_git_repo(tmp.path());

        let entry = validate_repository(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(entry.path, tmp.path().to_str().unwrap());
        assert!(!entry.name.is_empty());
    }

    #[test]
    fn test_validate_repository_not_exists() {
        let result = validate_repository("/nonexistent/path/to/repo");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("ディレクトリが存在しません"));
    }

    #[test]
    fn test_validate_repository_not_git_repo() {
        let tmp = TempDir::new().unwrap();
        // ディレクトリだけで .git なし
        let result = validate_repository(tmp.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("有効な Git リポジトリではありません"));
    }

    #[test]
    fn test_load_repositories_empty_file() {
        let tmp = TempDir::new().unwrap();
        let storage = tmp.path().join("repos.json");
        // ファイルが存在しない場合は空のリストを返す
        let repos = load_repositories(&storage).unwrap();
        assert!(repos.is_empty());
    }

    #[test]
    fn test_save_and_load_repositories() {
        let tmp = TempDir::new().unwrap();
        let storage = tmp.path().join("repos.json");

        let entries = vec![
            RepositoryEntry {
                name: "repo1".to_string(),
                path: "/tmp/repo1".to_string(),
            },
            RepositoryEntry {
                name: "repo2".to_string(),
                path: "/tmp/repo2".to_string(),
            },
        ];

        save_repositories(&storage, &entries).unwrap();
        let loaded = load_repositories(&storage).unwrap();
        assert_eq!(loaded, entries);
    }

    #[test]
    fn test_add_repository() {
        let tmp = TempDir::new().unwrap();
        let storage = tmp.path().join("data").join("repos.json");

        let repo_dir = TempDir::new().unwrap();
        create_git_repo(repo_dir.path());

        let entry = add_repository(&storage, repo_dir.path().to_str().unwrap()).unwrap();
        assert_eq!(entry.path, repo_dir.path().to_str().unwrap());

        let repos = load_repositories(&storage).unwrap();
        assert_eq!(repos.len(), 1);
        assert_eq!(repos[0], entry);
    }

    #[test]
    fn test_add_repository_duplicate() {
        let tmp = TempDir::new().unwrap();
        let storage = tmp.path().join("repos.json");

        let repo_dir = TempDir::new().unwrap();
        create_git_repo(repo_dir.path());

        let path = repo_dir.path().to_str().unwrap();
        add_repository(&storage, path).unwrap();
        let result = add_repository(&storage, path);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("すでに登録されています"));
    }

    #[test]
    fn test_remove_repository() {
        let tmp = TempDir::new().unwrap();
        let storage = tmp.path().join("repos.json");

        let repo_dir = TempDir::new().unwrap();
        create_git_repo(repo_dir.path());

        let path = repo_dir.path().to_str().unwrap();
        add_repository(&storage, path).unwrap();
        remove_repository(&storage, path).unwrap();

        let repos = load_repositories(&storage).unwrap();
        assert!(repos.is_empty());
    }

    #[test]
    fn test_remove_repository_not_found() {
        let tmp = TempDir::new().unwrap();
        let storage = tmp.path().join("repos.json");

        let result = remove_repository(&storage, "/nonexistent/repo");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("リポジトリが見つかりません"));
    }

    #[test]
    fn test_repository_entry_serializes() {
        let entry = RepositoryEntry {
            name: "my-repo".to_string(),
            path: "/home/user/my-repo".to_string(),
        };
        let json = serde_json::to_value(&entry).unwrap();
        assert_eq!(json["name"], "my-repo");
        assert_eq!(json["path"], "/home/user/my-repo");
    }

    #[test]
    fn test_default_storage_path() {
        let app_data = Path::new("/tmp/app_data");
        let path = default_storage_path(app_data);
        assert_eq!(path, PathBuf::from("/tmp/app_data/repositories.json"));
    }
}
