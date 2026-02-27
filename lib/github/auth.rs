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
    let client = reqwest::Client::new();
    let poll_interval = std::time::Duration::from_secs(interval);

    loop {
        tokio::time::sleep(poll_interval).await;

        let resp = client
            .post("https://github.com/login/oauth/access_token")
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
}
