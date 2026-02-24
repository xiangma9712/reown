use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

/// LLMクライアント
///
/// OpenAI互換APIを呼び出す最小限のクライアント。
/// `api_base` を変更することでOpenAI, Anthropic (proxy) 等に対応可能。
pub struct LlmClient {
    api_key: String,
    api_base: String,
    model: String,
}

impl LlmClient {
    /// OpenAI APIをデフォルトで使用するクライアントを作成する
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            api_key,
            api_base: "https://api.openai.com/v1".to_string(),
            model,
        }
    }

    /// カスタムAPIベースURLを指定してクライアントを作成する
    pub fn with_api_base(api_key: String, api_base: String, model: String) -> Self {
        Self {
            api_key,
            api_base,
            model,
        }
    }

    /// テキストプロンプトを送信して応答を取得する
    pub async fn chat(&self, prompt: &str) -> Result<String> {
        let client = reqwest::Client::new();
        let url = format!("{}/chat/completions", self.api_base);

        let request = ChatRequest {
            model: self.model.clone(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
        };

        let response = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .context("LLM APIリクエストの送信に失敗しました")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("LLM API returned {status}: {body}");
        }

        let chat_response: ChatResponse = response
            .json()
            .await
            .context("LLM APIレスポンスのパースに失敗しました")?;

        chat_response
            .choices
            .into_iter()
            .next()
            .map(|c| c.message.content)
            .context("LLM APIからの応答が空です")
    }
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
}

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_llm_client_new() {
        let client = LlmClient::new("test-key".to_string(), "gpt-4".to_string());
        assert_eq!(client.api_key, "test-key");
        assert_eq!(client.api_base, "https://api.openai.com/v1");
        assert_eq!(client.model, "gpt-4");
    }

    #[test]
    fn test_llm_client_with_api_base() {
        let client = LlmClient::with_api_base(
            "key".to_string(),
            "https://custom.api.com/v1".to_string(),
            "model".to_string(),
        );
        assert_eq!(client.api_base, "https://custom.api.com/v1");
    }

    #[test]
    fn test_chat_request_serializes() {
        let request = ChatRequest {
            model: "gpt-4".to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "hello".to_string(),
            }],
        };
        let json = serde_json::to_value(&request).unwrap();
        assert_eq!(json["model"], "gpt-4");
        assert_eq!(json["messages"][0]["role"], "user");
        assert_eq!(json["messages"][0]["content"], "hello");
    }

    #[test]
    fn test_chat_response_deserializes() {
        let json = r#"{
            "choices": [{
                "message": { "role": "assistant", "content": "response text" }
            }]
        }"#;
        let response: ChatResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.choices.len(), 1);
        assert_eq!(response.choices[0].message.content, "response text");
    }
}
