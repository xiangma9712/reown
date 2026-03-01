use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};

/// GitHub OAuth Device Flow のレスポンス
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceFlowResponse {
    /// デバイスコード（ポーリング時に使用）
    pub device_code: String,
    /// ユーザーに表示するコード
    pub user_code: String,
    /// ユーザーがアクセスするURL
    pub verification_uri: String,
    /// ポーリング間隔（秒）
    pub interval: u64,
    /// コードの有効期限（秒）
    pub expires_in: u64,
}

/// GitHub Device Flow API のレスポンス
#[derive(Debug, Deserialize)]
struct GhDeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    interval: u64,
    expires_in: u64,
}

/// GitHub Device Flow のトークンポーリングレスポンス
#[derive(Debug, Deserialize)]
struct GhTokenResponse {
    #[serde(default)]
    access_token: Option<String>,
    #[serde(default)]
    error: Option<String>,
}

/// GitHub OAuth Device Flow を開始する。
/// ユーザーに表示するコードとURLを含む `DeviceFlowResponse` を返す。
pub async fn start_device_flow(client_id: &str) -> Result<DeviceFlowResponse> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[("client_id", client_id), ("scope", "repo")])
        .send()
        .await
        .context("GitHub Device Flow APIへのリクエストに失敗")?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        bail!("GitHub Device Flow APIがエラーを返しました: {status} {body}");
    }

    let gh_resp: GhDeviceCodeResponse = resp
        .json()
        .await
        .context("GitHub Device Flowレスポンスのパースに失敗")?;

    Ok(DeviceFlowResponse {
        device_code: gh_resp.device_code,
        user_code: gh_resp.user_code,
        verification_uri: gh_resp.verification_uri,
        interval: gh_resp.interval,
        expires_in: gh_resp.expires_in,
    })
}

/// GitHub OAuth Device Flow のトークンをポーリングして取得する。
/// ユーザーが認証を完了するまで `interval` 秒ごとにポーリングする。
pub async fn poll_for_token(client_id: &str, device_code: &str, interval: u64) -> Result<String> {
    poll_for_token_with_url(
        "https://github.com/login/oauth/access_token",
        client_id,
        device_code,
        interval,
    )
    .await
}

/// `poll_for_token` の内部実装。テスト時にモックサーバーのURLを指定できる。
async fn poll_for_token_with_url(
    token_url: &str,
    client_id: &str,
    device_code: &str,
    interval: u64,
) -> Result<String> {
    let client = reqwest::Client::new();
    let poll_interval = std::time::Duration::from_secs(interval);

    loop {
        tokio::time::sleep(poll_interval).await;

        let resp = client
            .post(token_url)
            .header("Accept", "application/json")
            .form(&[
                ("client_id", client_id),
                ("device_code", device_code),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await
            .context("GitHubトークンポーリングに失敗")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            bail!("GitHubトークンAPIがエラーを返しました: {status} {body}");
        }

        let token_resp: GhTokenResponse = resp
            .json()
            .await
            .context("GitHubトークンレスポンスのパースに失敗")?;

        if let Some(token) = token_resp.access_token {
            return Ok(token);
        }

        match token_resp.error.as_deref() {
            Some("authorization_pending") => continue,
            Some("slow_down") => {
                // サーバーからslow_downが返された場合、間隔を追加で5秒延長
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                continue;
            }
            Some("expired_token") => {
                bail!("デバイスコードの有効期限が切れました。再度認証を開始してください。")
            }
            Some("access_denied") => bail!("ユーザーが認証を拒否しました。"),
            Some(err) => bail!("GitHubトークン取得エラー: {err}"),
            None => bail!("GitHubトークンレスポンスに予期しない形式が返されました"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    #[test]
    fn test_device_flow_response_serializes() {
        let resp = DeviceFlowResponse {
            device_code: "dc_123".to_string(),
            user_code: "ABCD-1234".to_string(),
            verification_uri: "https://github.com/login/device".to_string(),
            interval: 5,
            expires_in: 900,
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["device_code"], "dc_123");
        assert_eq!(json["user_code"], "ABCD-1234");
        assert_eq!(json["verification_uri"], "https://github.com/login/device");
        assert_eq!(json["interval"], 5);
        assert_eq!(json["expires_in"], 900);
    }

    #[test]
    fn test_device_flow_response_deserializes() {
        let json = serde_json::json!({
            "device_code": "dc_abc",
            "user_code": "WXYZ-5678",
            "verification_uri": "https://github.com/login/device",
            "interval": 10,
            "expires_in": 600
        });
        let resp: DeviceFlowResponse = serde_json::from_value(json).unwrap();
        assert_eq!(resp.device_code, "dc_abc");
        assert_eq!(resp.user_code, "WXYZ-5678");
        assert_eq!(resp.interval, 10);
        assert_eq!(resp.expires_in, 600);
    }

    // ── poll_for_token テスト ─────────────────────────────────────────────

    #[tokio::test]
    async fn test_poll_for_token_returns_token_on_success() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/")
            .match_header("Accept", "application/json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"access_token": "gho_mock_token_123"}"#)
            .create_async()
            .await;

        let token_url = server.url();
        let token = poll_for_token_with_url(&token_url, "test_client", "dc_test", 0)
            .await
            .unwrap();

        assert_eq!(token, "gho_mock_token_123");
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn test_poll_for_token_retries_on_authorization_pending() {
        let mut server = mockito::Server::new_async().await;
        // 1回目: authorization_pending → リトライ
        let pending_mock = server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"error": "authorization_pending"}"#)
            .expect(1)
            .create_async()
            .await;
        // 2回目: トークン返却
        let success_mock = server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"access_token": "gho_after_pending"}"#)
            .expect(1)
            .create_async()
            .await;

        let token_url = server.url();
        let token = poll_for_token_with_url(&token_url, "test_client", "dc_test", 0)
            .await
            .unwrap();

        assert_eq!(token, "gho_after_pending");
        pending_mock.assert_async().await;
        success_mock.assert_async().await;
    }

    #[tokio::test]
    async fn test_poll_for_token_fails_on_expired_token() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"error": "expired_token"}"#)
            .create_async()
            .await;

        let token_url = server.url();
        let err = poll_for_token_with_url(&token_url, "test_client", "dc_test", 0)
            .await
            .unwrap_err();

        assert!(err.to_string().contains("有効期限が切れました"));
    }

    #[tokio::test]
    async fn test_poll_for_token_fails_on_access_denied() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"error": "access_denied"}"#)
            .create_async()
            .await;

        let token_url = server.url();
        let err = poll_for_token_with_url(&token_url, "test_client", "dc_test", 0)
            .await
            .unwrap_err();

        assert!(err.to_string().contains("認証を拒否しました"));
    }

    #[tokio::test]
    async fn test_poll_for_token_fails_on_http_error() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/")
            .with_status(500)
            .with_body("Internal Server Error")
            .create_async()
            .await;

        let token_url = server.url();
        let err = poll_for_token_with_url(&token_url, "test_client", "dc_test", 0)
            .await
            .unwrap_err();

        assert!(err.to_string().contains("エラーを返しました"));
    }

    #[tokio::test]
    async fn test_poll_for_token_fails_on_unknown_error() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"error": "some_unknown_error"}"#)
            .create_async()
            .await;

        let token_url = server.url();
        let err = poll_for_token_with_url(&token_url, "test_client", "dc_test", 0)
            .await
            .unwrap_err();

        assert!(err.to_string().contains("some_unknown_error"));
    }

    #[tokio::test]
    async fn test_poll_for_token_fails_on_empty_response() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{}"#)
            .create_async()
            .await;

        let token_url = server.url();
        let err = poll_for_token_with_url(&token_url, "test_client", "dc_test", 0)
            .await
            .unwrap_err();

        assert!(err.to_string().contains("予期しない形式"));
    }

    /// poll_for_token 経由でトークンを取得し、keychain に保存するパスのテスト。
    /// poll_github_device_flow Tauri コマンドの内部ロジックを再現する。
    #[tokio::test]
    #[serial]
    async fn test_poll_for_token_and_save_to_keychain() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"access_token": "gho_device_flow_token"}"#)
            .create_async()
            .await;

        let token_url = server.url();
        let token = poll_for_token_with_url(&token_url, "test_client", "dc_test", 0)
            .await
            .unwrap();

        // poll_github_device_flow と同じパス: トークンを keychain に保存
        let save_result = crate::config::save_github_token(&token);
        if save_result.is_err() {
            eprintln!("Skipping keychain test: keychain not available in this environment");
            return;
        }

        // 保存されたトークンを確認
        let loaded = crate::config::load_github_token().unwrap();
        assert_eq!(loaded, "gho_device_flow_token");

        // クリーンアップ
        let _ = crate::config::delete_github_token();
    }
}
