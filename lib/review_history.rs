use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::analysis::ChangeCategory;
use crate::analysis::RiskLevel;
use crate::github::ReviewEvent;

/// レビューアクションの記録
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReviewRecord {
    /// PR番号
    pub pr_number: u64,
    /// リポジトリ（owner/repo 形式）
    pub repository: String,
    /// レビューアクション（APPROVE / REQUEST_CHANGES）
    pub action: ReviewEvent,
    /// リスクレベル
    pub risk_level: RiskLevel,
    /// レビュー実施日時（ISO 8601）
    pub timestamp: String,
    /// 変更カテゴリ一覧
    pub categories: Vec<ChangeCategory>,
}

/// レビュー履歴をJSONファイルから読み込む。ファイルが存在しない場合は空のリストを返す。
pub fn load_review_history(storage_path: &Path) -> Result<Vec<ReviewRecord>> {
    if !storage_path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(storage_path)
        .with_context(|| format!("レビュー履歴の読み込みに失敗: {}", storage_path.display()))?;

    let records: Vec<ReviewRecord> =
        serde_json::from_str(&content).with_context(|| "レビュー履歴の JSON パースに失敗")?;

    Ok(records)
}

/// レビュー履歴をJSONファイルに保存する
pub fn save_review_history(storage_path: &Path, records: &[ReviewRecord]) -> Result<()> {
    if let Some(parent) = storage_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("ディレクトリの作成に失敗: {}", parent.display()))?;
    }

    let content = serde_json::to_string_pretty(records)
        .with_context(|| "レビュー履歴の JSON シリアライズに失敗")?;

    std::fs::write(storage_path, content)
        .with_context(|| format!("レビュー履歴の保存に失敗: {}", storage_path.display()))?;

    Ok(())
}

/// レビュー履歴に1件追加する
pub fn add_review_record(storage_path: &Path, record: ReviewRecord) -> Result<()> {
    let mut records = load_review_history(storage_path)?;
    records.push(record);
    save_review_history(storage_path, &records)?;
    Ok(())
}

/// レビュー履歴ファイルのデフォルトパスを返す
pub fn default_review_history_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("review_history.json")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_record(pr_number: u64, repository: &str) -> ReviewRecord {
        ReviewRecord {
            pr_number,
            repository: repository.to_string(),
            action: ReviewEvent::Approve,
            risk_level: RiskLevel::Low,
            timestamp: "2025-01-15T10:30:00Z".to_string(),
            categories: vec![ChangeCategory::Logic, ChangeCategory::Test],
        }
    }

    #[test]
    fn test_load_review_history_no_file() {
        let tmp = TempDir::new().unwrap();
        let storage = tmp.path().join("review_history.json");
        let records = load_review_history(&storage).unwrap();
        assert!(records.is_empty());
    }

    #[test]
    fn test_save_and_load_review_history() {
        let tmp = TempDir::new().unwrap();
        let storage = tmp.path().join("review_history.json");

        let records = vec![make_record(1, "owner/repo"), make_record(2, "owner/repo")];

        save_review_history(&storage, &records).unwrap();
        let loaded = load_review_history(&storage).unwrap();
        assert_eq!(loaded, records);
    }

    #[test]
    fn test_add_review_record() {
        let tmp = TempDir::new().unwrap();
        let storage = tmp.path().join("review_history.json");

        add_review_record(&storage, make_record(1, "owner/repo")).unwrap();
        add_review_record(&storage, make_record(2, "owner/repo")).unwrap();

        let records = load_review_history(&storage).unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].pr_number, 1);
        assert_eq!(records[1].pr_number, 2);
    }

    #[test]
    fn test_save_creates_parent_dirs() {
        let tmp = TempDir::new().unwrap();
        let storage = tmp
            .path()
            .join("nested")
            .join("dir")
            .join("review_history.json");

        let records = vec![make_record(1, "owner/repo")];
        save_review_history(&storage, &records).unwrap();
        let loaded = load_review_history(&storage).unwrap();
        assert_eq!(loaded, records);
    }

    #[test]
    fn test_load_invalid_json() {
        let tmp = TempDir::new().unwrap();
        let storage = tmp.path().join("review_history.json");
        std::fs::write(&storage, "not valid json").unwrap();
        let result = load_review_history(&storage);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("JSON パースに失敗"));
    }

    #[test]
    fn test_review_record_serializes() {
        let record = ReviewRecord {
            pr_number: 42,
            repository: "owner/repo".to_string(),
            action: ReviewEvent::Approve,
            risk_level: RiskLevel::Medium,
            timestamp: "2025-01-15T10:30:00Z".to_string(),
            categories: vec![ChangeCategory::Logic],
        };
        let json = serde_json::to_value(&record).unwrap();
        assert_eq!(json["pr_number"], 42);
        assert_eq!(json["repository"], "owner/repo");
        assert_eq!(json["action"], "APPROVE");
        assert_eq!(json["risk_level"], "Medium");
        assert_eq!(json["timestamp"], "2025-01-15T10:30:00Z");
        assert_eq!(json["categories"][0], "Logic");
    }

    #[test]
    fn test_review_record_request_changes() {
        let record = ReviewRecord {
            pr_number: 10,
            repository: "org/project".to_string(),
            action: ReviewEvent::RequestChanges,
            risk_level: RiskLevel::High,
            timestamp: "2025-02-01T00:00:00Z".to_string(),
            categories: vec![ChangeCategory::Logic, ChangeCategory::Config],
        };
        let json = serde_json::to_value(&record).unwrap();
        assert_eq!(json["action"], "REQUEST_CHANGES");
        assert_eq!(json["risk_level"], "High");
        assert_eq!(json["categories"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn test_review_record_deserializes() {
        let json = r#"{
            "pr_number": 5,
            "repository": "owner/repo",
            "action": "APPROVE",
            "risk_level": "Low",
            "timestamp": "2025-01-01T00:00:00Z",
            "categories": ["Test", "Documentation"]
        }"#;
        let record: ReviewRecord = serde_json::from_str(json).unwrap();
        assert_eq!(record.pr_number, 5);
        assert_eq!(record.action, ReviewEvent::Approve);
        assert_eq!(record.risk_level, RiskLevel::Low);
        assert_eq!(record.categories.len(), 2);
    }

    #[test]
    fn test_default_review_history_path() {
        let app_data = Path::new("/tmp/app_data");
        let path = default_review_history_path(app_data);
        assert_eq!(path, PathBuf::from("/tmp/app_data/review_history.json"));
    }
}
