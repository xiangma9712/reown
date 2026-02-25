use std::pin::Pin;
use std::time::Duration;

use anyhow::{Context, Result};
use futures::stream::Stream;
use reqwest::StatusCode;

use super::stream::parse_sse_stream;
use super::types::{LlmRequest, LlmResponse, Message, StreamEvent};

const DEFAULT_API_BASE: &str = "https://api.anthropic.com";
const DEFAULT_TIMEOUT_SECS: u64 = 30;
const ANTHROPIC_VERSION: &str = "2023-06-01";

/// リトライ対象のHTTPステータスコード
const RETRYABLE_STATUS_CODES: &[u16] = &[
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    529, // Overloaded
];

/// リトライ設定
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// 最大リトライ回数
    pub max_retries: u32,
    /// 初期待機時間（秒）
    pub initial_backoff_secs: u64,
    /// バックオフ倍率
    pub backoff_multiplier: u64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_backoff_secs: 1,
            backoff_multiplier: 2,
        }
    }
}

/// ステータスコードがリトライ対象かどうかを判定する
fn is_retryable_status(status: StatusCode) -> bool {
    RETRYABLE_STATUS_CODES.contains(&status.as_u16())
}

/// レスポンスから retry-after ヘッダーの値（秒）を取得する
fn parse_retry_after(response: &reqwest::Response) -> Option<u64> {
    response
        .headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
}

/// Anthropic Messages API互換 LLMクライアント
///
/// `api_base` を変更することでローカルLLM等にも対応可能。
/// `api_key` は `Option` とし、ローカルLLMの場合は省略できる。
pub struct LlmClient {
    api_key: Option<String>,
    api_base: String,
    model: String,
    http: reqwest::Client,
    retry_config: RetryConfig,
}

impl LlmClient {
    /// デフォルトのAnthropic APIを使用するクライアントを作成する
    pub fn new(api_key: Option<String>, model: String) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(DEFAULT_TIMEOUT_SECS))
            .build()
            .expect("HTTPクライアントの初期化に失敗");
        Self {
            api_key,
            api_base: DEFAULT_API_BASE.to_string(),
            model,
            http,
            retry_config: RetryConfig::default(),
        }
    }

    /// カスタムAPIベースURLを指定してクライアントを作成する
    pub fn with_api_base(api_key: Option<String>, api_base: String, model: String) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(DEFAULT_TIMEOUT_SECS))
            .build()
            .expect("HTTPクライアントの初期化に失敗");
        Self {
            api_key,
            api_base,
            model,
            http,
            retry_config: RetryConfig::default(),
        }
    }

    /// リトライ設定を変更する
    pub fn with_retry_config(mut self, config: RetryConfig) -> Self {
        self.retry_config = config;
        self
    }

    /// Anthropic Messages APIにリクエストを送信し、レスポンスを取得する
    pub async fn send(&self, request: &LlmRequest) -> Result<LlmResponse> {
        let url = format!("{}/v1/messages", self.api_base);

        for attempt in 0..=self.retry_config.max_retries {
            let mut builder = self
                .http
                .post(&url)
                .header("content-type", "application/json")
                .header("anthropic-version", ANTHROPIC_VERSION);

            if let Some(ref key) = self.api_key {
                builder = builder.header("x-api-key", key);
            }

            let response = builder
                .json(request)
                .send()
                .await
                .context("LLM APIリクエストの送信に失敗しました")?;

            if response.status().is_success() {
                let llm_response: LlmResponse = response
                    .json()
                    .await
                    .context("LLM APIレスポンスのパースに失敗しました")?;
                return Ok(llm_response);
            }

            let status = response.status();

            // リトライ対象でない場合は即座にエラーを返す
            if !is_retryable_status(status) || attempt == self.retry_config.max_retries {
                let body = response.text().await.unwrap_or_default();
                anyhow::bail!("LLM API returned {status}: {body}");
            }

            // 429の場合は retry-after ヘッダーを尊重する
            let wait_secs = if status == StatusCode::TOO_MANY_REQUESTS {
                parse_retry_after(&response).unwrap_or(
                    self.retry_config.initial_backoff_secs
                        * self.retry_config.backoff_multiplier.pow(attempt),
                )
            } else {
                self.retry_config.initial_backoff_secs
                    * self.retry_config.backoff_multiplier.pow(attempt)
            };

            tokio::time::sleep(Duration::from_secs(wait_secs)).await;
        }

        // ここには到達しないはずだが、安全のため
        anyhow::bail!("LLM APIリクエストのリトライ上限に達しました")
    }

    /// Anthropic Messages APIにストリーミングリクエストを送信し、SSEイベントのストリームを返す
    ///
    /// リクエストに `"stream": true` を付与して送信し、SSEレスポンスをパースする。
    pub async fn send_stream(
        &self,
        request: &LlmRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send>>> {
        let url = format!("{}/v1/messages", self.api_base);

        // リクエストボディに stream: true を付与
        let body =
            serde_json::to_value(request).context("LlmRequestのシリアライズに失敗しました")?;
        let mut stream_body = body.clone();
        stream_body["stream"] = serde_json::Value::Bool(true);

        for attempt in 0..=self.retry_config.max_retries {
            let mut builder = self
                .http
                .post(&url)
                .header("content-type", "application/json")
                .header("anthropic-version", ANTHROPIC_VERSION);

            if let Some(ref key) = self.api_key {
                builder = builder.header("x-api-key", key);
            }

            let response = builder
                .json(&stream_body)
                .send()
                .await
                .context("LLM APIストリーミングリクエストの送信に失敗しました")?;

            if response.status().is_success() {
                let byte_stream = response.bytes_stream();
                return Ok(parse_sse_stream(byte_stream));
            }

            let status = response.status();

            // リトライ対象でない場合は即座にエラーを返す
            if !is_retryable_status(status) || attempt == self.retry_config.max_retries {
                let body = response.text().await.unwrap_or_default();
                anyhow::bail!("LLM API returned {status}: {body}");
            }

            // 429の場合は retry-after ヘッダーを尊重する
            let wait_secs = if status == StatusCode::TOO_MANY_REQUESTS {
                parse_retry_after(&response).unwrap_or(
                    self.retry_config.initial_backoff_secs
                        * self.retry_config.backoff_multiplier.pow(attempt),
                )
            } else {
                self.retry_config.initial_backoff_secs
                    * self.retry_config.backoff_multiplier.pow(attempt)
            };

            tokio::time::sleep(Duration::from_secs(wait_secs)).await;
        }

        // ここには到達しないはずだが、安全のため
        anyhow::bail!("LLM APIストリーミングリクエストのリトライ上限に達しました")
    }

    /// テキストプロンプトを送信して応答テキストを取得する（簡易メソッド）
    ///
    /// 内部で `send()` を呼び出し、最初のテキストブロックの内容を返す。
    pub async fn chat(&self, prompt: &str) -> Result<String> {
        let request = LlmRequest {
            model: self.model.clone(),
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            max_tokens: 4096,
            system: None,
            temperature: None,
            top_p: None,
            top_k: None,
            stop_sequences: None,
        };

        let response = self.send(&request).await?;

        response
            .content
            .into_iter()
            .find(|block| block.block_type == "text")
            .map(|block| block.text)
            .context("LLM APIからの応答が空です")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::types::{ContentBlock, LlmResponse, Usage};

    #[test]
    fn test_llm_client_new() {
        let client = LlmClient::new(
            Some("test-key".to_string()),
            "claude-sonnet-4-5-20250929".to_string(),
        );
        assert_eq!(client.api_key, Some("test-key".to_string()));
        assert_eq!(client.api_base, "https://api.anthropic.com");
        assert_eq!(client.model, "claude-sonnet-4-5-20250929");
    }

    #[test]
    fn test_llm_client_new_without_api_key() {
        let client = LlmClient::new(None, "local-model".to_string());
        assert_eq!(client.api_key, None);
        assert_eq!(client.api_base, "https://api.anthropic.com");
        assert_eq!(client.model, "local-model");
    }

    #[test]
    fn test_llm_client_with_api_base() {
        let client = LlmClient::with_api_base(
            None,
            "http://localhost:11434".to_string(),
            "llama3".to_string(),
        );
        assert_eq!(client.api_key, None);
        assert_eq!(client.api_base, "http://localhost:11434");
        assert_eq!(client.model, "llama3");
    }

    #[test]
    fn test_chat_builds_correct_request() {
        // chat()が構築するLlmRequestの構造を検証
        let request = LlmRequest {
            model: "claude-sonnet-4-5-20250929".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: "hello".to_string(),
            }],
            max_tokens: 4096,
            system: None,
            temperature: None,
            top_p: None,
            top_k: None,
            stop_sequences: None,
        };
        let json = serde_json::to_value(&request).unwrap();
        assert_eq!(json["model"], "claude-sonnet-4-5-20250929");
        assert_eq!(json["messages"][0]["role"], "user");
        assert_eq!(json["messages"][0]["content"], "hello");
        assert_eq!(json["max_tokens"], 4096);
        // Optionalフィールドは省略される
        assert!(json.get("system").is_none());
        assert!(json.get("temperature").is_none());
    }

    #[test]
    fn test_llm_response_text_extraction() {
        // send()のレスポンスからテキストを抽出するロジックを検証
        let response = LlmResponse {
            id: "msg_test".to_string(),
            response_type: "message".to_string(),
            role: "assistant".to_string(),
            content: vec![ContentBlock {
                block_type: "text".to_string(),
                text: "response text".to_string(),
            }],
            model: "claude-sonnet-4-5-20250929".to_string(),
            stop_reason: Some("end_turn".to_string()),
            stop_sequence: None,
            usage: Usage {
                input_tokens: 10,
                output_tokens: 20,
            },
        };

        let text = response
            .content
            .into_iter()
            .find(|block| block.block_type == "text")
            .map(|block| block.text);

        assert_eq!(text, Some("response text".to_string()));
    }

    #[test]
    fn test_llm_response_empty_content_returns_none() {
        let response = LlmResponse {
            id: "msg_empty".to_string(),
            response_type: "message".to_string(),
            role: "assistant".to_string(),
            content: vec![],
            model: "claude-sonnet-4-5-20250929".to_string(),
            stop_reason: Some("end_turn".to_string()),
            stop_sequence: None,
            usage: Usage {
                input_tokens: 5,
                output_tokens: 0,
            },
        };

        let text = response
            .content
            .into_iter()
            .find(|block| block.block_type == "text")
            .map(|block| block.text);

        assert!(text.is_none());
    }

    #[tokio::test]
    async fn test_send_connection_refused_returns_error() {
        let client = LlmClient::with_api_base(
            None,
            "http://127.0.0.1:1".to_string(),
            "test-model".to_string(),
        )
        .with_retry_config(RetryConfig {
            max_retries: 0,
            ..RetryConfig::default()
        });
        let request = LlmRequest {
            model: "test-model".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: "hello".to_string(),
            }],
            max_tokens: 100,
            system: None,
            temperature: None,
            top_p: None,
            top_k: None,
            stop_sequences: None,
        };

        let result = client.send(&request).await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("LLM APIリクエストの送信に失敗しました"));
    }

    #[tokio::test]
    async fn test_chat_connection_refused_returns_error() {
        let client = LlmClient::with_api_base(
            None,
            "http://127.0.0.1:1".to_string(),
            "test-model".to_string(),
        )
        .with_retry_config(RetryConfig {
            max_retries: 0,
            ..RetryConfig::default()
        });

        let result = client.chat("hello").await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("LLM APIリクエストの送信に失敗しました"));
    }

    // --- リトライ関連テスト ---

    #[test]
    fn test_retry_config_default() {
        let config = RetryConfig::default();
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.initial_backoff_secs, 1);
        assert_eq!(config.backoff_multiplier, 2);
    }

    #[test]
    fn test_retry_config_custom() {
        let config = RetryConfig {
            max_retries: 5,
            initial_backoff_secs: 2,
            backoff_multiplier: 3,
        };
        assert_eq!(config.max_retries, 5);
        assert_eq!(config.initial_backoff_secs, 2);
        assert_eq!(config.backoff_multiplier, 3);
    }

    #[test]
    fn test_is_retryable_status() {
        // リトライ対象
        assert!(is_retryable_status(StatusCode::TOO_MANY_REQUESTS)); // 429
        assert!(is_retryable_status(StatusCode::INTERNAL_SERVER_ERROR)); // 500
        assert!(is_retryable_status(StatusCode::BAD_GATEWAY)); // 502
        assert!(is_retryable_status(StatusCode::SERVICE_UNAVAILABLE)); // 503
        assert!(is_retryable_status(StatusCode::from_u16(529).unwrap())); // 529

        // リトライ対象外
        assert!(!is_retryable_status(StatusCode::OK)); // 200
        assert!(!is_retryable_status(StatusCode::BAD_REQUEST)); // 400
        assert!(!is_retryable_status(StatusCode::UNAUTHORIZED)); // 401
        assert!(!is_retryable_status(StatusCode::FORBIDDEN)); // 403
        assert!(!is_retryable_status(StatusCode::NOT_FOUND)); // 404
    }

    #[test]
    fn test_with_retry_config() {
        let client =
            LlmClient::new(None, "test-model".to_string()).with_retry_config(RetryConfig {
                max_retries: 5,
                initial_backoff_secs: 2,
                backoff_multiplier: 3,
            });
        assert_eq!(client.retry_config.max_retries, 5);
        assert_eq!(client.retry_config.initial_backoff_secs, 2);
        assert_eq!(client.retry_config.backoff_multiplier, 3);
    }

    #[test]
    fn test_default_client_has_default_retry_config() {
        let client = LlmClient::new(None, "test-model".to_string());
        assert_eq!(client.retry_config.max_retries, 3);
        assert_eq!(client.retry_config.initial_backoff_secs, 1);
        assert_eq!(client.retry_config.backoff_multiplier, 2);
    }

    #[test]
    fn test_parse_retry_after_valid() {
        let response = http::Response::builder()
            .status(429)
            .header("retry-after", "5")
            .body("")
            .unwrap();
        let reqwest_response = reqwest::Response::from(response);
        assert_eq!(parse_retry_after(&reqwest_response), Some(5));
    }

    #[test]
    fn test_parse_retry_after_missing() {
        let response = http::Response::builder().status(429).body("").unwrap();
        let reqwest_response = reqwest::Response::from(response);
        assert_eq!(parse_retry_after(&reqwest_response), None);
    }

    #[test]
    fn test_parse_retry_after_non_numeric() {
        let response = http::Response::builder()
            .status(429)
            .header("retry-after", "not-a-number")
            .body("")
            .unwrap();
        let reqwest_response = reqwest::Response::from(response);
        assert_eq!(parse_retry_after(&reqwest_response), None);
    }

    #[test]
    fn test_retryable_status_codes_list() {
        assert_eq!(RETRYABLE_STATUS_CODES, &[429, 500, 502, 503, 529]);
    }
}
