use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::analysis::ChangeCategory;

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

/// リスクしきい値（Low/Medium/High の境界スコア）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RiskThresholds {
    /// Low の上限スコア（このスコア以下は Low）
    pub low_max: u32,
    /// Medium の上限スコア（このスコア以下は Medium、超えると High）
    pub medium_max: u32,
}

impl Default for RiskThresholds {
    fn default() -> Self {
        Self {
            low_max: 25,
            medium_max: 55,
        }
    }
}

/// センシティブパスパターンとそのスコア
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SensitivePattern {
    /// マッチするキーワード（小文字パスに対して contains で判定）
    pub pattern: String,
    /// マッチ時に付与するスコア
    pub score: u32,
}

/// リスク設定（スコアリングルールのカスタマイズ）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RiskConfig {
    /// カテゴリ別リスク重み
    #[serde(default = "default_category_weights")]
    pub category_weights: HashMap<ChangeCategory, f64>,
    /// sensitive path パターンのリスト（パターンとスコアのペア）
    #[serde(default = "default_sensitive_patterns")]
    pub sensitive_patterns: Vec<SensitivePattern>,
    /// 変更ファイル数の閾値とスコア（ファイル数上限, スコア）のリスト（昇順）
    #[serde(default = "default_file_count_thresholds")]
    pub file_count_thresholds: Vec<(usize, u32)>,
    /// 変更行数の閾値とスコア（行数上限, スコア）のリスト（昇順）
    #[serde(default = "default_line_count_thresholds")]
    pub line_count_thresholds: Vec<(usize, u32)>,
    /// ロジック変更があるのにテストがない場合のペナルティスコア
    #[serde(default = "default_missing_test_penalty")]
    pub missing_test_penalty: u32,
    /// Low/Medium/High の境界スコア
    #[serde(default)]
    pub risk_thresholds: RiskThresholds,
}

fn default_category_weights() -> HashMap<ChangeCategory, f64> {
    let mut weights = HashMap::new();
    weights.insert(ChangeCategory::Logic, 1.0);
    weights.insert(ChangeCategory::Test, 1.0);
    weights.insert(ChangeCategory::Config, 1.0);
    weights.insert(ChangeCategory::CI, 1.0);
    weights.insert(ChangeCategory::Documentation, 1.0);
    weights.insert(ChangeCategory::Dependency, 1.0);
    weights.insert(ChangeCategory::Refactor, 1.0);
    weights.insert(ChangeCategory::Other, 1.0);
    weights
}

fn default_sensitive_patterns() -> Vec<SensitivePattern> {
    vec![
        // 認証・セキュリティ関連 (score: 25)
        SensitivePattern {
            pattern: "auth".to_string(),
            score: 25,
        },
        SensitivePattern {
            pattern: "security".to_string(),
            score: 25,
        },
        SensitivePattern {
            pattern: "permission".to_string(),
            score: 25,
        },
        SensitivePattern {
            pattern: "credential".to_string(),
            score: 25,
        },
        SensitivePattern {
            pattern: "token".to_string(),
            score: 25,
        },
        SensitivePattern {
            pattern: "secret".to_string(),
            score: 25,
        },
        SensitivePattern {
            pattern: "encrypt".to_string(),
            score: 25,
        },
        SensitivePattern {
            pattern: "password".to_string(),
            score: 25,
        },
        // DB・マイグレーション関連 (score: 20)
        SensitivePattern {
            pattern: "migration".to_string(),
            score: 20,
        },
        SensitivePattern {
            pattern: "schema".to_string(),
            score: 20,
        },
        SensitivePattern {
            pattern: "database".to_string(),
            score: 20,
        },
        SensitivePattern {
            pattern: "db/".to_string(),
            score: 20,
        },
        // API関連 (score: 15)
        SensitivePattern {
            pattern: "api/".to_string(),
            score: 15,
        },
        SensitivePattern {
            pattern: "endpoint".to_string(),
            score: 15,
        },
        SensitivePattern {
            pattern: "route".to_string(),
            score: 15,
        },
        // インフラ・デプロイ関連 (score: 20)
        SensitivePattern {
            pattern: "deploy".to_string(),
            score: 20,
        },
        SensitivePattern {
            pattern: "infra".to_string(),
            score: 20,
        },
        SensitivePattern {
            pattern: "terraform".to_string(),
            score: 20,
        },
        SensitivePattern {
            pattern: "docker".to_string(),
            score: 20,
        },
        SensitivePattern {
            pattern: "k8s".to_string(),
            score: 20,
        },
        SensitivePattern {
            pattern: "kubernetes".to_string(),
            score: 20,
        },
    ]
}

fn default_file_count_thresholds() -> Vec<(usize, u32)> {
    // (ファイル数上限, スコア) — 昇順。最後のエントリを超えるとそのスコアが適用される
    vec![(3, 0), (10, 10), (20, 20), (usize::MAX, 30)]
}

fn default_line_count_thresholds() -> Vec<(usize, u32)> {
    // (行数上限, スコア) — 昇順
    vec![(50, 0), (200, 10), (500, 20), (usize::MAX, 30)]
}

fn default_missing_test_penalty() -> u32 {
    15
}

impl Default for RiskConfig {
    fn default() -> Self {
        Self {
            category_weights: default_category_weights(),
            sensitive_patterns: default_sensitive_patterns(),
            file_count_thresholds: default_file_count_thresholds(),
            line_count_thresholds: default_line_count_thresholds(),
            missing_test_penalty: default_missing_test_penalty(),
            risk_thresholds: RiskThresholds::default(),
        }
    }
}

/// auto-approve時にPRに付与するデフォルトラベル名
fn default_auto_approve_label() -> String {
    "auto-approved".to_string()
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
    /// リスク設定
    #[serde(default)]
    pub risk_config: RiskConfig,
    /// auto-approve時にPRに付与するラベル名
    #[serde(default = "default_auto_approve_label")]
    pub auto_approve_label: String,
}

impl Default for AutomationConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            auto_approve_max_risk: AutoApproveMaxRisk::Low,
            enable_auto_merge: false,
            auto_merge_method: MergeMethod::Merge,
            risk_config: RiskConfig::default(),
            auto_approve_label: default_auto_approve_label(),
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

/// アプリ設定（リポジトリ既定値・LLM・オートメーション等を永続化する）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct AppConfig {
    /// デフォルトの GitHub owner
    pub default_owner: String,
    /// デフォルトの GitHub リポジトリ名
    pub default_repo: String,
    /// LLM設定
    #[serde(default)]
    pub llm: LlmConfig,
    /// グローバルのオートメーション設定（フォールバック用）
    #[serde(default)]
    pub automation: AutomationConfig,
    /// リポジトリ別のオートメーション設定（キーは "owner/repo" 形式）
    #[serde(default)]
    pub repo_automation: HashMap<String, AutomationConfig>,
    /// オンボーディング完了フラグ
    #[serde(default)]
    pub onboarding_completed: bool,
}

impl AppConfig {
    /// 指定リポジトリのオートメーション設定を返す。
    /// リポジトリ別設定があればそれを返し、なければグローバル設定を返す。
    pub fn get_automation_config(&self, repo_id: &str) -> &AutomationConfig {
        self.repo_automation
            .get(repo_id)
            .unwrap_or(&self.automation)
    }

    /// リポジトリ別のオートメーション設定を保存する。
    pub fn set_repo_automation_config(&mut self, repo_id: String, config: AutomationConfig) {
        self.repo_automation.insert(repo_id, config);
    }
}

/// config.json の github_token を Keychain にマイグレーションする。
///
/// - `github_token` が存在し、非空の場合は Keychain に保存し、config.json から削除する
/// - `github_token` が空またはフィールドが存在しない場合は何もしない
/// - Keychain への保存が失敗した場合はエラーを返す（config.json は変更されない）
pub fn migrate_github_token_to_keychain(config_path: &Path) -> Result<()> {
    if !config_path.exists() {
        return Ok(());
    }

    let content = std::fs::read_to_string(config_path)
        .with_context(|| format!("設定ファイルの読み込みに失敗: {}", config_path.display()))?;

    let mut json: serde_json::Value =
        serde_json::from_str(&content).with_context(|| "設定ファイルの JSON パースに失敗")?;

    let token = json
        .get("github_token")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if token.is_empty() {
        return Ok(());
    }

    // Keychain に保存
    save_github_token(token).with_context(|| "GitHubトークンのKeychainへの保存に失敗")?;

    // config.json から github_token を削除（空文字列にする）
    if let Some(obj) = json.as_object_mut() {
        obj.remove("github_token");
    }

    let new_content =
        serde_json::to_string_pretty(&json).with_context(|| "設定の JSON シリアライズに失敗")?;

    std::fs::write(config_path, new_content)
        .with_context(|| format!("設定ファイルの保存に失敗: {}", config_path.display()))?;

    Ok(())
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
const KEYRING_GITHUB_TOKEN: &str = "github_token";

/// LLM APIキーをOS keychainに保存する
pub fn save_llm_api_key(api_key: &str) -> Result<()> {
    if api_key.trim().is_empty() {
        anyhow::bail!("LLM APIキーが空です");
    }
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

/// GitHubトークンをOS keychainに保存する
pub fn save_github_token(token: &str) -> Result<()> {
    if token.trim().is_empty() {
        anyhow::bail!("GitHubトークンが空です");
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_GITHUB_TOKEN)
        .context("keychainエントリの作成に失敗")?;
    entry
        .set_password(token)
        .context("keychainへのGitHubトークン保存に失敗")?;
    Ok(())
}

/// GitHubトークンをOS keychainから読み込む
pub fn load_github_token() -> Result<String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_GITHUB_TOKEN)
        .context("keychainエントリの作成に失敗")?;
    entry
        .get_password()
        .context("keychainからのGitHubトークン読み込みに失敗")
}

/// GitHubトークンをOS keychainから削除する
pub fn delete_github_token() -> Result<()> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_GITHUB_TOKEN)
        .context("keychainエントリの作成に失敗")?;
    entry
        .delete_credential()
        .context("keychainからのGitHubトークン削除に失敗")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;
    use tempfile::TempDir;

    #[test]
    fn test_load_config_no_file() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        let config = load_config(&config_path).unwrap();
        assert_eq!(config, AppConfig::default());
        assert_eq!(config.default_owner, "");
        assert_eq!(config.default_repo, "");
    }

    #[test]
    fn test_save_and_load_config() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");

        let config = AppConfig {
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
            default_owner: "owner".to_string(),
            default_repo: "repo".to_string(),
            ..Default::default()
        };
        let json = serde_json::to_value(&config).unwrap();
        assert_eq!(json["default_owner"], "owner");
        assert_eq!(json["default_repo"], "repo");
    }

    #[test]
    fn test_app_config_default() {
        let config = AppConfig::default();
        assert_eq!(config.default_owner, "");
        assert_eq!(config.default_repo, "");
        assert!(!config.onboarding_completed);
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
        assert_eq!(config.default_owner, "o");
        assert_eq!(config.llm, LlmConfig::default());
    }

    #[test]
    fn test_save_and_load_config_with_llm() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");

        let config = AppConfig {
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
        assert_eq!(config.default_owner, "o");
        assert_eq!(config.automation, AutomationConfig::default());
    }

    #[test]
    fn test_save_and_load_config_with_automation() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");

        let config = AppConfig {
            default_owner: "org".to_string(),
            default_repo: "repo".to_string(),
            llm: LlmConfig::default(),
            automation: AutomationConfig {
                enabled: true,
                auto_approve_max_risk: AutoApproveMaxRisk::Medium,
                enable_auto_merge: true,
                auto_merge_method: MergeMethod::Squash,
                ..Default::default()
            },
            ..Default::default()
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
            ..Default::default()
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

    // ── リポジトリ別設定テスト ──────────────────────────────────────────

    #[test]
    fn test_app_config_default_has_empty_repo_automation() {
        let config = AppConfig::default();
        assert!(config.repo_automation.is_empty());
    }

    #[test]
    fn test_get_automation_config_fallback_to_global() {
        let config = AppConfig {
            automation: AutomationConfig {
                enabled: true,
                auto_approve_max_risk: AutoApproveMaxRisk::Medium,
                ..Default::default()
            },
            ..Default::default()
        };
        let result = config.get_automation_config("owner/repo");
        assert!(result.enabled);
        assert_eq!(result.auto_approve_max_risk, AutoApproveMaxRisk::Medium);
    }

    #[test]
    fn test_get_automation_config_returns_repo_specific() {
        let mut config = AppConfig {
            automation: AutomationConfig {
                enabled: false,
                auto_approve_max_risk: AutoApproveMaxRisk::Low,
                ..Default::default()
            },
            ..Default::default()
        };
        config.repo_automation.insert(
            "owner/repo".to_string(),
            AutomationConfig {
                enabled: true,
                auto_approve_max_risk: AutoApproveMaxRisk::Medium,
                enable_auto_merge: true,
                auto_merge_method: MergeMethod::Squash,
                risk_config: RiskConfig::default(),
                auto_approve_label: default_auto_approve_label(),
            },
        );

        // リポジトリ別設定が返される
        let result = config.get_automation_config("owner/repo");
        assert!(result.enabled);
        assert_eq!(result.auto_approve_max_risk, AutoApproveMaxRisk::Medium);
        assert!(result.enable_auto_merge);
        assert_eq!(result.auto_merge_method, MergeMethod::Squash);

        // 別のリポジトリはグローバル設定にフォールバック
        let fallback = config.get_automation_config("other/repo");
        assert!(!fallback.enabled);
        assert_eq!(fallback.auto_approve_max_risk, AutoApproveMaxRisk::Low);
    }

    #[test]
    fn test_set_repo_automation_config() {
        let mut config = AppConfig::default();
        let repo_config = AutomationConfig {
            enabled: true,
            auto_approve_max_risk: AutoApproveMaxRisk::Medium,
            enable_auto_merge: true,
            auto_merge_method: MergeMethod::Rebase,
            risk_config: RiskConfig::default(),
            auto_approve_label: default_auto_approve_label(),
        };
        config.set_repo_automation_config("owner/repo".to_string(), repo_config.clone());

        assert_eq!(config.repo_automation.len(), 1);
        assert_eq!(config.repo_automation["owner/repo"], repo_config);
    }

    #[test]
    fn test_set_repo_automation_config_overwrite() {
        let mut config = AppConfig::default();
        config.set_repo_automation_config(
            "owner/repo".to_string(),
            AutomationConfig {
                enabled: true,
                ..Default::default()
            },
        );
        config.set_repo_automation_config(
            "owner/repo".to_string(),
            AutomationConfig {
                enabled: false,
                auto_approve_max_risk: AutoApproveMaxRisk::Medium,
                ..Default::default()
            },
        );

        assert_eq!(config.repo_automation.len(), 1);
        assert!(!config.repo_automation["owner/repo"].enabled);
        assert_eq!(
            config.repo_automation["owner/repo"].auto_approve_max_risk,
            AutoApproveMaxRisk::Medium
        );
    }

    #[test]
    fn test_backward_compat_load_without_repo_automation_field() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        // repo_automationフィールドなしの旧形式JSON
        let old_json = r#"{"github_token":"tok","default_owner":"o","default_repo":"r","automation":{"enabled":true,"auto_approve_max_risk":"Low","enable_auto_merge":false,"auto_merge_method":"Merge"}}"#;
        std::fs::write(&config_path, old_json).unwrap();
        let config = load_config(&config_path).unwrap();
        assert_eq!(config.default_owner, "o");
        assert!(config.automation.enabled);
        assert!(config.repo_automation.is_empty());
    }

    #[test]
    fn test_save_and_load_config_with_repo_automation() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");

        let mut repo_automation = std::collections::HashMap::new();
        repo_automation.insert(
            "org/repo-a".to_string(),
            AutomationConfig {
                enabled: true,
                auto_approve_max_risk: AutoApproveMaxRisk::Medium,
                enable_auto_merge: true,
                auto_merge_method: MergeMethod::Squash,
                risk_config: RiskConfig::default(),
                auto_approve_label: default_auto_approve_label(),
            },
        );
        repo_automation.insert(
            "org/repo-b".to_string(),
            AutomationConfig {
                enabled: false,
                auto_approve_max_risk: AutoApproveMaxRisk::Low,
                enable_auto_merge: false,
                auto_merge_method: MergeMethod::Merge,
                risk_config: RiskConfig::default(),
                auto_approve_label: default_auto_approve_label(),
            },
        );

        let config = AppConfig {
            default_owner: "org".to_string(),
            default_repo: "repo-a".to_string(),
            llm: LlmConfig::default(),
            automation: AutomationConfig::default(),
            repo_automation,
            ..Default::default()
        };

        save_config(&config_path, &config).unwrap();
        let loaded = load_config(&config_path).unwrap();
        assert_eq!(loaded, config);
        assert_eq!(loaded.repo_automation.len(), 2);
        assert!(loaded.repo_automation["org/repo-a"].enabled);
        assert!(!loaded.repo_automation["org/repo-b"].enabled);
    }

    #[test]
    fn test_repo_automation_serializes() {
        let mut config = AppConfig::default();
        config.set_repo_automation_config(
            "owner/repo".to_string(),
            AutomationConfig {
                enabled: true,
                auto_approve_max_risk: AutoApproveMaxRisk::Medium,
                enable_auto_merge: true,
                auto_merge_method: MergeMethod::Rebase,
                risk_config: RiskConfig::default(),
                auto_approve_label: default_auto_approve_label(),
            },
        );

        let json = serde_json::to_value(&config).unwrap();
        let repo_auto = &json["repo_automation"]["owner/repo"];
        assert_eq!(repo_auto["enabled"], true);
        assert_eq!(repo_auto["auto_approve_max_risk"], "Medium");
        assert_eq!(repo_auto["enable_auto_merge"], true);
        assert_eq!(repo_auto["auto_merge_method"], "Rebase");
    }

    #[test]
    fn test_multiple_repos_get_automation_config() {
        let mut config = AppConfig::default();
        config.set_repo_automation_config(
            "org/alpha".to_string(),
            AutomationConfig {
                enabled: true,
                auto_approve_max_risk: AutoApproveMaxRisk::Low,
                ..Default::default()
            },
        );
        config.set_repo_automation_config(
            "org/beta".to_string(),
            AutomationConfig {
                enabled: true,
                auto_approve_max_risk: AutoApproveMaxRisk::Medium,
                enable_auto_merge: true,
                auto_merge_method: MergeMethod::Squash,
                risk_config: RiskConfig::default(),
                auto_approve_label: default_auto_approve_label(),
            },
        );

        let alpha = config.get_automation_config("org/alpha");
        assert_eq!(alpha.auto_approve_max_risk, AutoApproveMaxRisk::Low);

        let beta = config.get_automation_config("org/beta");
        assert_eq!(beta.auto_approve_max_risk, AutoApproveMaxRisk::Medium);
        assert!(beta.enable_auto_merge);

        // 未設定リポジトリはグローバルにフォールバック
        let unknown = config.get_automation_config("other/unknown");
        assert_eq!(*unknown, AutomationConfig::default());
    }

    // ── RiskConfig テスト ───────────────────────────────────────────────

    #[test]
    fn test_risk_thresholds_default() {
        let thresholds = RiskThresholds::default();
        assert_eq!(thresholds.low_max, 25);
        assert_eq!(thresholds.medium_max, 55);
    }

    #[test]
    fn test_risk_config_default() {
        let config = RiskConfig::default();
        assert_eq!(config.category_weights.len(), 8);
        assert_eq!(
            config
                .category_weights
                .get(&crate::analysis::ChangeCategory::Logic),
            Some(&1.0)
        );
        assert_eq!(
            config
                .category_weights
                .get(&crate::analysis::ChangeCategory::Test),
            Some(&1.0)
        );
        assert!(!config.sensitive_patterns.is_empty());
        assert!(config
            .sensitive_patterns
            .iter()
            .any(|p| p.pattern == "auth"));
        assert!(config
            .sensitive_patterns
            .iter()
            .any(|p| p.pattern == "migration"));
        assert_eq!(config.risk_thresholds, RiskThresholds::default());
    }

    #[test]
    fn test_automation_config_default_has_risk_config() {
        let config = AutomationConfig::default();
        assert_eq!(config.risk_config, RiskConfig::default());
    }

    #[test]
    fn test_risk_config_serializes() {
        let config = RiskConfig::default();
        let json = serde_json::to_value(&config).unwrap();
        assert!(json["category_weights"].is_object());
        assert!(json["sensitive_patterns"].is_array());
        assert_eq!(json["risk_thresholds"]["low_max"], 25);
        assert_eq!(json["risk_thresholds"]["medium_max"], 55);
    }

    #[test]
    fn test_risk_thresholds_serializes() {
        let thresholds = RiskThresholds {
            low_max: 30,
            medium_max: 60,
        };
        let json = serde_json::to_value(&thresholds).unwrap();
        assert_eq!(json["low_max"], 30);
        assert_eq!(json["medium_max"], 60);
    }

    #[test]
    fn test_backward_compat_load_without_risk_config_field() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        // risk_configフィールドなしの旧形式JSON
        let old_json = r#"{"github_token":"tok","default_owner":"o","default_repo":"r","automation":{"enabled":true,"auto_approve_max_risk":"Low","enable_auto_merge":false,"auto_merge_method":"Merge"}}"#;
        std::fs::write(&config_path, old_json).unwrap();
        let config = load_config(&config_path).unwrap();
        assert!(config.automation.enabled);
        assert_eq!(config.automation.risk_config, RiskConfig::default());
    }

    #[test]
    fn test_save_and_load_config_with_risk_config() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");

        let mut category_weights = HashMap::new();
        category_weights.insert(crate::analysis::ChangeCategory::Logic, 2.0);
        category_weights.insert(crate::analysis::ChangeCategory::Test, 0.5);

        let config = AppConfig {
            default_owner: "org".to_string(),
            default_repo: "repo".to_string(),
            llm: LlmConfig::default(),
            automation: AutomationConfig {
                enabled: true,
                auto_approve_max_risk: AutoApproveMaxRisk::Medium,
                enable_auto_merge: false,
                auto_merge_method: MergeMethod::Merge,
                risk_config: RiskConfig {
                    category_weights,
                    sensitive_patterns: vec![SensitivePattern {
                        pattern: "custom/path".to_string(),
                        score: 30,
                    }],
                    file_count_thresholds: default_file_count_thresholds(),
                    line_count_thresholds: default_line_count_thresholds(),
                    missing_test_penalty: 15,
                    risk_thresholds: RiskThresholds {
                        low_max: 30,
                        medium_max: 60,
                    },
                },
                auto_approve_label: default_auto_approve_label(),
            },
            ..Default::default()
        };

        save_config(&config_path, &config).unwrap();
        let loaded = load_config(&config_path).unwrap();
        assert_eq!(loaded, config);
        assert_eq!(
            loaded
                .automation
                .risk_config
                .category_weights
                .get(&crate::analysis::ChangeCategory::Logic),
            Some(&2.0)
        );
        assert_eq!(loaded.automation.risk_config.sensitive_patterns.len(), 1);
        assert_eq!(
            loaded.automation.risk_config.sensitive_patterns[0].pattern,
            "custom/path"
        );
        assert_eq!(loaded.automation.risk_config.risk_thresholds.low_max, 30);
        assert_eq!(loaded.automation.risk_config.risk_thresholds.medium_max, 60);
    }

    // ── Onboarding テスト ───────────────────────────────────────────────

    #[test]
    fn test_backward_compat_load_without_onboarding_completed_field() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        // onboarding_completedフィールドなしの旧形式JSON
        let old_json = r#"{"github_token":"tok","default_owner":"o","default_repo":"r"}"#;
        std::fs::write(&config_path, old_json).unwrap();
        let config = load_config(&config_path).unwrap();
        assert_eq!(config.default_owner, "o");
        assert!(!config.onboarding_completed);
    }

    #[test]
    fn test_save_and_load_config_with_onboarding_completed() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");

        let config = AppConfig {
            default_owner: "org".to_string(),
            default_repo: "repo".to_string(),
            onboarding_completed: true,
            ..Default::default()
        };

        save_config(&config_path, &config).unwrap();
        let loaded = load_config(&config_path).unwrap();
        assert_eq!(loaded, config);
        assert!(loaded.onboarding_completed);
    }

    // ── GitHub Token マイグレーションテスト ──────────────────────────────

    #[test]
    fn test_migrate_github_token_no_file() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        // ファイルが存在しない場合は何も起きない
        let result = migrate_github_token_to_keychain(&config_path);
        assert!(result.is_ok());
    }

    #[test]
    fn test_migrate_github_token_empty_token() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        // github_token が空文字列の場合は何も起きない
        let json = r#"{"github_token":"","default_owner":"o","default_repo":"r"}"#;
        std::fs::write(&config_path, json).unwrap();
        let result = migrate_github_token_to_keychain(&config_path);
        assert!(result.is_ok());
        // config.json は変更されない（github_token フィールドが残ったまま）
        let content = std::fs::read_to_string(&config_path).unwrap();
        assert!(content.contains("github_token"));
    }

    #[test]
    fn test_migrate_github_token_missing_field() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        // github_token フィールドがない場合は何も起きない
        let json = r#"{"default_owner":"o","default_repo":"r"}"#;
        std::fs::write(&config_path, json).unwrap();
        let result = migrate_github_token_to_keychain(&config_path);
        assert!(result.is_ok());
    }

    #[test]
    #[serial]
    fn test_migrate_github_token_to_keychain_success() {
        // keychainが利用可能かチェック
        let test_result = save_github_token("gho_migration-test-probe");
        if test_result.is_err() {
            eprintln!("Skipping keychain test: keychain not available in this environment");
            return;
        }
        let _ = delete_github_token();

        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        let json = r#"{"github_token":"ghp_migrate_me","default_owner":"o","default_repo":"r"}"#;
        std::fs::write(&config_path, json).unwrap();

        // マイグレーション実行
        migrate_github_token_to_keychain(&config_path).unwrap();

        // Keychain にトークンが保存されていることを確認
        let token = match load_github_token() {
            Ok(t) => t,
            Err(_) => {
                eprintln!(
                    "Skipping keychain test: saved token could not be loaded (CI environment)"
                );
                return;
            }
        };
        assert_eq!(token, "ghp_migrate_me");

        // config.json から github_token が削除されていることを確認
        let content = std::fs::read_to_string(&config_path).unwrap();
        assert!(!content.contains("github_token"));

        // load_config でも正常に読み込めることを確認
        let config = load_config(&config_path).unwrap();
        assert_eq!(config.default_owner, "o");
        assert_eq!(config.default_repo, "r");

        // クリーンアップ
        let _ = delete_github_token();
    }

    #[test]
    fn test_backward_compat_load_without_github_token_field() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("config.json");
        // github_token フィールドなしのJSON（マイグレーション済みの状態）
        let json = r#"{"default_owner":"o","default_repo":"r"}"#;
        std::fs::write(&config_path, json).unwrap();
        let config = load_config(&config_path).unwrap();
        assert_eq!(config.default_owner, "o");
        assert_eq!(config.default_repo, "r");
    }

    // ── GitHub Token Keychain テスト ────────────────────────────────────

    #[test]
    #[serial]
    fn test_save_and_delete_github_token() {
        let save_result = save_github_token("gho_test-github-token-for-reown-test");
        if save_result.is_err() {
            eprintln!("Skipping keychain test: keychain not available in this environment");
            return;
        }

        let token = match load_github_token() {
            Ok(t) => t,
            Err(_) => {
                eprintln!(
                    "Skipping keychain test: saved token could not be loaded (CI environment)"
                );
                return;
            }
        };
        assert_eq!(token, "gho_test-github-token-for-reown-test");

        delete_github_token().unwrap();
        let result = load_github_token();
        assert!(result.is_err());
    }

    #[test]
    fn test_save_llm_api_key_rejects_empty() {
        let result = save_llm_api_key("");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("空"));
    }

    #[test]
    fn test_save_llm_api_key_rejects_whitespace_only() {
        let result = save_llm_api_key("   ");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("空"));
    }

    #[test]
    fn test_save_github_token_rejects_empty() {
        let result = save_github_token("");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("空"));
    }

    #[test]
    fn test_save_github_token_rejects_whitespace_only() {
        let result = save_github_token("   ");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("空"));
    }
}
