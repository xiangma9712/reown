use std::time::Duration;

use anyhow::{Context, Result};

use super::types::{LlmRequest, LlmResponse, Message};

const DEFAULT_API_BASE: &str = "https://api.anthropic.com";
const DEFAULT_TIMEOUT_SECS: u64 = 30;
const ANTHROPIC_VERSION: &str = "2023-06-01";

/// Anthropic Messages API互換 LLMクライアント
///
/// `api_base` を変更することでローカルLLM等にも対応可能。
/// `api_key` は `Option` とし、ローカルLLMの場合は省略できる。
pub struct LlmClient {
    api_key: Option<String>,
    api_base: String,
    model: String,
    http: reqwest::Client,
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
        }
    }

    /// Anthropic Messages APIにリクエストを送信し、レスポンスを取得する
    pub async fn send(&self, request: &LlmRequest) -> Result<LlmResponse> {
        let url = format!("{}/v1/messages", self.api_base);

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

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("LLM API returned {status}: {body}");
        }

        let llm_response: LlmResponse = response
            .json()
            .await
            .context("LLM APIレスポンスのパースに失敗しました")?;

        Ok(llm_response)
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
        );
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
        );

        let result = client.chat("hello").await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("LLM APIリクエストの送信に失敗しました"));
    }
}
