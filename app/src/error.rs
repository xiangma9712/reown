use serde::Serialize;

/// Tauri コマンドから返す構造化エラー型。
///
/// フロントエンドでは `kind` フィールドでエラー種別を判別し、
/// `message` フィールドで詳細を表示できる。
#[derive(Debug, Serialize)]
pub struct AppError {
    /// エラー種別
    pub kind: ErrorKind,
    /// 人間向けの詳細メッセージ
    pub message: String,
}

/// エラーの分類。フロントエンドはこの値でエラーハンドリングを分岐できる。
#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorKind {
    /// リポジトリが見つからない、またはGit操作の失敗
    Git,
    /// GitHub APIのネットワークエラーやHTTPエラー
    #[serde(rename = "github")]
    GitHub,
    /// リポジトリ管理（追加・削除・永続化）のエラー
    Storage,
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl AppError {
    pub fn git(err: anyhow::Error) -> Self {
        Self {
            kind: ErrorKind::Git,
            message: format!("{err:#}"),
        }
    }

    pub fn github(err: anyhow::Error) -> Self {
        Self {
            kind: ErrorKind::GitHub,
            message: format!("{err:#}"),
        }
    }

    pub fn storage(err: anyhow::Error) -> Self {
        Self {
            kind: ErrorKind::Storage,
            message: format!("{err:#}"),
        }
    }
}
