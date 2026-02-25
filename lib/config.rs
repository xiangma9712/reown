use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// 自動approveの最大リスクレベル
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum AutoApproveMaxRisk {
    #[default]
    Low,
    Medium,
}

/// auto merge時のマージ方法
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum MergeMethod {
    #[default]
    Merge,
    Squash,
    Rebase,
}

/// オートメーション設定
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AutomationConfig {
    /// オートメーション有効/無効
    #[serde(default)]
    pub enabled: bool,
    /// 自動approveする最大リスクレベル
    #[serde(default)]
    pub auto_approve_max_risk: AutoApproveMaxRisk,
    /// auto merge有効/無効
    #[serde(default)]
    pub enable_auto_merge: bool,
    /// auto mergeのマージ方法
    #[serde(default)]
    pub auto_merge_method: MergeMethod,
}

impl Default for AutomationConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            auto_approve_max_risk: AutoApproveMaxRisk::Low,
            enable_auto_merge: false,
            auto_merge_method: MergeMethod::Merge,
        }
    }
}

/// LLM設定
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LlmConfig {
    /// LLM APIのエンドポイント
    #[serde(default = "default_llm_endpoint")]
    pub llm_endpoint: String,
    /// LLMモデル名
    #[serde(default = "default_llm_model")]
    pub llm_model: String,
    /// APIキーがkeychainに保存されているかのフラグ
    #[serde(default)]
    pub llm_api_key_stored: bool,
}

fn default_llm_endpoint() -> String {
    "https://api.anthropic.com".to_string()
}

fn default_llm_model() -> String {
    "claude-sonnet-4-5-20250929".to_string()
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            llm_endpoint: default_llm_endpoint(),
            llm_model: default_llm_model(),
            llm_api_key_stored: false,
        }
    }
}

/// アプリ設定（GitHub トークン等を永続化する）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct AppConfig {
    /// GitHub トークン
    pub github_token: String,
    /// デフォルトの GitHub owner
    pub default_owner: String,
    /// デフォルトの GitHub リポジトリ名
    pub default_repo: String,
    /// LLM設定
    #[serde(default)]
    pub llm: LlmConfig,
    /// オートメーション設定
    #[serde(default)]
    pub automation: AutomationConfig,
}

/// 設定を JSON ファイルから読み込む。ファイルが存在しない場合はデフォルト値を返す。
pub fn load_config(config_path: &Path) -> Result<AppConfig> {
    if !config_path.exists() {
        return Ok(AppConfig::default());
    }

    let content = std::fs::read_to_string(config_path)
        .with_context(|| format!("設定ファイルの読み込みに失敗: {}", config_path.display()))?;

    let config: AppConfig =
        serde_json::from_str(&content).with_context(|| "設定ファイルの JSON パースに失敗")?;

    Ok(config)
}

/// 設定を JSON ファイルに保存する
pub fn save_config(config_path: &Path, config: &AppConfig) -> Result<()> {
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("ディレクトリの作成に失敗: {}", parent.display()))?;
    }

    let content =
        serde_json::to_string_pretty(config).with_context(|| "設定の JSON シリアライズに失敗")?;

    std::fs::write(config_path, content)
        .with_context(|| format!("設定ファイルの保存に失敗: {}", config_path.display()))?;

    Ok(())
}

/// 設定ファイルのデフォルトパスを返す
pub fn default_config_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("config.json")
}

const KEYRING_SERVICE: &str = "com.reown.app";
const KEYRING_LLM_API_KEY: &str = "llm_api_key";

/// LLM APIキーをOS keychainに保存する
pub fn save_llm_api_key(api_key: &str) -> Result<()> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_LLM_API_KEY)
        .context("keychainエントリの作成に失敗")?;
    entry
        .set_password(api_key)
        .context("keychainへのAPIキー保存に失敗")?;
    Ok(())
}

/// LLM APIキーをOS keychainから読み込む
pub fn load_llm_api_key() -> Result<String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_LLM_API_KEY)
        .context("keychainエントリの作成に失敗")?;
    entry
        .get_password()
        .context("keychainからのAPIキー読み込みに失敗")
}

/// LLM APIキーをOS keychainから削除する
pub fn delete_llm_api_key() -> Result<()> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_LLM_API_KEY)
        .context("keychainエントリの作成に失敗")?;
    entry
        .delete_credential()
        .context("keychainからのAPIキー削除に失敗")?;
    Ok(())
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
            ..Default::default()
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
            ..Default::default()
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
            ..Default::default()
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
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("JSON パースに失敗"));
    }

    #[test]
    fn test_llm_config_default() {
        let config = LlmConfig::default();
        assert_eq!(config.llm_endpoint, "https://api.anthropic.com");
        assert_eq!(config.llm_model, "claude-sonnet-4-5-20250929");
        assert!(!config.llm_api_key_stored);
    }

    #[test]
    fn test_app_config_default_has_llm() {
        let config = AppConfig::default();
        assert_eq!(config.llm, LlmConfig::default());
    }

    #[test]
    fn test_backward_compat_load_without_llm_field() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        // 旧形式のJSON（llmフィールドなし）
        let old_json = r#"{"github_token":"tok","default_owner":"o","default_repo":"r"}"#;
        std::fs::write(&config_path, old_json).unwrap();
        let config = load_config(&config_path).unwrap();
        assert_eq!(config.github_token, "tok");
        assert_eq!(config.llm, LlmConfig::default());
    }

    #[test]
    fn test_save_and_load_config_with_llm() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");

        let config = AppConfig {
            github_token: "ghp_test".to_string(),
            default_owner: "org".to_string(),
            default_repo: "repo".to_string(),
            llm: LlmConfig {
                llm_endpoint: "http://localhost:11434".to_string(),
                llm_model: "llama3".to_string(),
                llm_api_key_stored: true,
            },
            ..Default::default()
        };

        save_config(&config_path, &config).unwrap();
        let loaded = load_config(&config_path).unwrap();
        assert_eq!(loaded, config);
        assert_eq!(loaded.llm.llm_endpoint, "http://localhost:11434");
        assert_eq!(loaded.llm.llm_model, "llama3");
        assert!(loaded.llm.llm_api_key_stored);
    }

    #[test]
    fn test_llm_config_serializes() {
        let config = LlmConfig {
            llm_endpoint: "https://api.example.com".to_string(),
            llm_model: "test-model".to_string(),
            llm_api_key_stored: true,
        };
        let json = serde_json::to_value(&config).unwrap();
        assert_eq!(json["llm_endpoint"], "https://api.example.com");
        assert_eq!(json["llm_model"], "test-model");
        assert_eq!(json["llm_api_key_stored"], true);
    }

    #[test]
    fn test_automation_config_default() {
        let config = AutomationConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.auto_approve_max_risk, AutoApproveMaxRisk::Low);
    }

    #[test]
    fn test_app_config_default_has_automation() {
        let config = AppConfig::default();
        assert_eq!(config.automation, AutomationConfig::default());
        assert!(!config.automation.enabled);
    }

    #[test]
    fn test_backward_compat_load_without_automation_field() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        // automationフィールドなしの旧形式JSON
        let old_json = r#"{"github_token":"tok","default_owner":"o","default_repo":"r","llm":{"llm_endpoint":"https://api.anthropic.com","llm_model":"claude-sonnet-4-5-20250929","llm_api_key_stored":false}}"#;
        std::fs::write(&config_path, old_json).unwrap();
        let config = load_config(&config_path).unwrap();
        assert_eq!(config.github_token, "tok");
        assert_eq!(config.automation, AutomationConfig::default());
    }

    #[test]
    fn test_save_and_load_config_with_automation() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");

        let config = AppConfig {
            github_token: "ghp_test".to_string(),
            default_owner: "org".to_string(),
            default_repo: "repo".to_string(),
            llm: LlmConfig::default(),
            automation: AutomationConfig {
                enabled: true,
                auto_approve_max_risk: AutoApproveMaxRisk::Medium,
                enable_auto_merge: true,
                auto_merge_method: MergeMethod::Squash,
            },
        };

        save_config(&config_path, &config).unwrap();
        let loaded = load_config(&config_path).unwrap();
        assert_eq!(loaded, config);
        assert!(loaded.automation.enabled);
        assert_eq!(
            loaded.automation.auto_approve_max_risk,
            AutoApproveMaxRisk::Medium
        );
        assert!(loaded.automation.enable_auto_merge);
        assert_eq!(loaded.automation.auto_merge_method, MergeMethod::Squash);
    }

    #[test]
    fn test_automation_config_serializes() {
        let config = AutomationConfig {
            enabled: true,
            auto_approve_max_risk: AutoApproveMaxRisk::Medium,
            enable_auto_merge: true,
            auto_merge_method: MergeMethod::Rebase,
        };
        let json = serde_json::to_value(&config).unwrap();
        assert_eq!(json["enabled"], true);
        assert_eq!(json["auto_approve_max_risk"], "Medium");
        assert_eq!(json["enable_auto_merge"], true);
        assert_eq!(json["auto_merge_method"], "Rebase");
    }

    #[test]
    fn test_auto_approve_max_risk_serializes() {
        let low = serde_json::to_value(&AutoApproveMaxRisk::Low).unwrap();
        assert_eq!(low, "Low");
        let medium = serde_json::to_value(&AutoApproveMaxRisk::Medium).unwrap();
        assert_eq!(medium, "Medium");
    }

    #[test]
    fn test_automation_config_default_has_auto_merge() {
        let config = AutomationConfig::default();
        assert!(!config.enable_auto_merge);
        assert_eq!(config.auto_merge_method, MergeMethod::Merge);
    }

    #[test]
    fn test_merge_method_serializes() {
        assert_eq!(serde_json::to_value(&MergeMethod::Merge).unwrap(), "Merge");
        assert_eq!(
            serde_json::to_value(&MergeMethod::Squash).unwrap(),
            "Squash"
        );
        assert_eq!(
            serde_json::to_value(&MergeMethod::Rebase).unwrap(),
            "Rebase"
        );
    }

    #[test]
    fn test_backward_compat_load_without_auto_merge_fields() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        // automationにenable_auto_merge/auto_merge_methodなしの旧形式JSON
        let old_json = r#"{"github_token":"tok","default_owner":"o","default_repo":"r","automation":{"enabled":true,"auto_approve_max_risk":"Low"}}"#;
        std::fs::write(&config_path, old_json).unwrap();
        let config = load_config(&config_path).unwrap();
        assert!(config.automation.enabled);
        assert!(!config.automation.enable_auto_merge);
        assert_eq!(config.automation.auto_merge_method, MergeMethod::Merge);
    }
}
