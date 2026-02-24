use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// アプリ設定（GitHub トークン等を永続化する）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct AppConfig {
    /// GitHub トークン
    pub github_token: String,
    /// デフォルトの GitHub owner
    pub default_owner: String,
    /// デフォルトの GitHub リポジトリ名
    pub default_repo: String,
}

/// 設定を JSON ファイルから読み込む。ファイルが存在しない場合はデフォルト値を返す。
pub fn load_config(config_path: &Path) -> Result<AppConfig> {
    if !config_path.exists() {
        return Ok(AppConfig::default());
    }

    let content = std::fs::read_to_string(config_path)
        .with_context(|| format!("設定ファイルの読み込みに失敗: {}", config_path.display()))?;

    let config: AppConfig = serde_json::from_str(&content)
        .with_context(|| "設定ファイルの JSON パースに失敗")?;

    Ok(config)
}

/// 設定を JSON ファイルに保存する
pub fn save_config(config_path: &Path, config: &AppConfig) -> Result<()> {
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("ディレクトリの作成に失敗: {}", parent.display()))?;
    }

    let content = serde_json::to_string_pretty(config)
        .with_context(|| "設定の JSON シリアライズに失敗")?;

    std::fs::write(config_path, content)
        .with_context(|| format!("設定ファイルの保存に失敗: {}", config_path.display()))?;

    Ok(())
}

/// 設定ファイルのデフォルトパスを返す
pub fn default_config_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("config.json")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_load_config_no_file() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        let config = load_config(&config_path).unwrap();
        assert_eq!(config, AppConfig::default());
        assert_eq!(config.github_token, "");
        assert_eq!(config.default_owner, "");
        assert_eq!(config.default_repo, "");
    }

    #[test]
    fn test_save_and_load_config() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");

        let config = AppConfig {
            github_token: "ghp_test123".to_string(),
            default_owner: "my-org".to_string(),
            default_repo: "my-repo".to_string(),
        };

        save_config(&config_path, &config).unwrap();
        let loaded = load_config(&config_path).unwrap();
        assert_eq!(loaded, config);
    }

    #[test]
    fn test_save_config_creates_parent_dirs() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("nested").join("dir").join("config.json");

        let config = AppConfig {
            github_token: "ghp_abc".to_string(),
            default_owner: "owner".to_string(),
            default_repo: "repo".to_string(),
        };

        save_config(&config_path, &config).unwrap();
        let loaded = load_config(&config_path).unwrap();
        assert_eq!(loaded, config);
    }

    #[test]
    fn test_default_config_path() {
        let app_data = Path::new("/tmp/app_data");
        let path = default_config_path(app_data);
        assert_eq!(path, PathBuf::from("/tmp/app_data/config.json"));
    }

    #[test]
    fn test_app_config_serializes() {
        let config = AppConfig {
            github_token: "ghp_token".to_string(),
            default_owner: "owner".to_string(),
            default_repo: "repo".to_string(),
        };
        let json = serde_json::to_value(&config).unwrap();
        assert_eq!(json["github_token"], "ghp_token");
        assert_eq!(json["default_owner"], "owner");
        assert_eq!(json["default_repo"], "repo");
    }

    #[test]
    fn test_app_config_default() {
        let config = AppConfig::default();
        assert_eq!(config.github_token, "");
        assert_eq!(config.default_owner, "");
        assert_eq!(config.default_repo, "");
    }

    #[test]
    fn test_load_config_invalid_json() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        std::fs::write(&config_path, "not valid json").unwrap();
        let result = load_config(&config_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("JSON パースに失敗"));
    }
}
