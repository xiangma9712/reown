use serde::{Deserialize, Serialize};

/// Anthropic Messages APIリクエスト
///
/// <https://docs.anthropic.com/en/api/messages>
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmRequest {
    /// モデルID（例: "claude-sonnet-4-5-20250929"）
    pub model: String,
    /// メッセージ配列（user/assistantロールが交互）
    pub messages: Vec<Message>,
    /// 最大出力トークン数
    pub max_tokens: u32,
    /// システムプロンプト（トップレベルで指定）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    /// サンプリング温度（0.0〜1.0）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    /// Top-pサンプリング
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f64>,
    /// Top-kサンプリング
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<u32>,
    /// 生成を停止するシーケンス
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,
}

/// メッセージ（リクエスト用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// ロール（"user" または "assistant"）
    pub role: String,
    /// メッセージ内容
    pub content: String,
}

/// Anthropic Messages APIレスポンス
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmResponse {
    /// メッセージID
    pub id: String,
    /// オブジェクトタイプ（常に "message"）
    #[serde(rename = "type")]
    pub response_type: String,
    /// ロール（常に "assistant"）
    pub role: String,
    /// レスポンスコンテンツブロック
    pub content: Vec<ContentBlock>,
    /// 使用されたモデル
    pub model: String,
    /// 生成が停止した理由
    pub stop_reason: Option<String>,
    /// 停止シーケンス（stop_reasonが"stop_sequence"の場合）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequence: Option<String>,
    /// トークン使用量
    pub usage: Usage,
}

/// レスポンスのコンテンツブロック
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentBlock {
    /// ブロックタイプ（"text"等）
    #[serde(rename = "type")]
    pub block_type: String,
    /// テキスト内容
    pub text: String,
}

/// トークン使用量
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    /// 入力トークン数
    pub input_tokens: u32,
    /// 出力トークン数
    pub output_tokens: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_llm_request_serializes_required_fields() {
        let request = LlmRequest {
            model: "claude-sonnet-4-5-20250929".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            max_tokens: 1024,
            system: None,
            temperature: None,
            top_p: None,
            top_k: None,
            stop_sequences: None,
        };
        let json = serde_json::to_value(&request).unwrap();
        assert_eq!(json["model"], "claude-sonnet-4-5-20250929");
        assert_eq!(json["messages"][0]["role"], "user");
        assert_eq!(json["messages"][0]["content"], "Hello");
        assert_eq!(json["max_tokens"], 1024);
        // Optionalフィールドはnoneの場合省略される
        assert!(json.get("system").is_none());
        assert!(json.get("temperature").is_none());
        assert!(json.get("top_p").is_none());
        assert!(json.get("top_k").is_none());
        assert!(json.get("stop_sequences").is_none());
    }

    #[test]
    fn test_llm_request_serializes_optional_fields() {
        let request = LlmRequest {
            model: "claude-sonnet-4-5-20250929".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            max_tokens: 2048,
            system: Some("You are a helpful assistant.".to_string()),
            temperature: Some(0.7),
            top_p: Some(0.9),
            top_k: Some(40),
            stop_sequences: Some(vec!["STOP".to_string()]),
        };
        let json = serde_json::to_value(&request).unwrap();
        assert_eq!(json["system"], "You are a helpful assistant.");
        assert_eq!(json["temperature"], 0.7);
        assert_eq!(json["top_p"], 0.9);
        assert_eq!(json["top_k"], 40);
        assert_eq!(json["stop_sequences"][0], "STOP");
    }

    #[test]
    fn test_llm_request_roundtrip() {
        let request = LlmRequest {
            model: "claude-sonnet-4-5-20250929".to_string(),
            messages: vec![
                Message {
                    role: "user".to_string(),
                    content: "What is Rust?".to_string(),
                },
                Message {
                    role: "assistant".to_string(),
                    content: "Rust is a systems programming language.".to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: "Tell me more.".to_string(),
                },
            ],
            max_tokens: 4096,
            system: Some("Be concise.".to_string()),
            temperature: Some(0.5),
            top_p: None,
            top_k: None,
            stop_sequences: None,
        };
        let json_str = serde_json::to_string(&request).unwrap();
        let deserialized: LlmRequest = serde_json::from_str(&json_str).unwrap();
        assert_eq!(deserialized.model, request.model);
        assert_eq!(deserialized.messages.len(), 3);
        assert_eq!(deserialized.max_tokens, 4096);
        assert_eq!(deserialized.system, Some("Be concise.".to_string()));
        assert_eq!(deserialized.temperature, Some(0.5));
        assert!(deserialized.top_p.is_none());
    }

    #[test]
    fn test_llm_response_deserializes_api_example() {
        let json = r#"{
            "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
            "type": "message",
            "role": "assistant",
            "content": [
                {
                    "type": "text",
                    "text": "Hi! My name is Claude."
                }
            ],
            "model": "claude-sonnet-4-5-20250929",
            "stop_reason": "end_turn",
            "stop_sequence": null,
            "usage": {
                "input_tokens": 25,
                "output_tokens": 150
            }
        }"#;
        let response: LlmResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.id, "msg_01XFDUDYJgAACzvnptvVoYEL");
        assert_eq!(response.response_type, "message");
        assert_eq!(response.role, "assistant");
        assert_eq!(response.content.len(), 1);
        assert_eq!(response.content[0].block_type, "text");
        assert_eq!(response.content[0].text, "Hi! My name is Claude.");
        assert_eq!(response.model, "claude-sonnet-4-5-20250929");
        assert_eq!(response.stop_reason, Some("end_turn".to_string()));
        assert!(response.stop_sequence.is_none());
        assert_eq!(response.usage.input_tokens, 25);
        assert_eq!(response.usage.output_tokens, 150);
    }

    #[test]
    fn test_llm_response_roundtrip() {
        let response = LlmResponse {
            id: "msg_abc123".to_string(),
            response_type: "message".to_string(),
            role: "assistant".to_string(),
            content: vec![ContentBlock {
                block_type: "text".to_string(),
                text: "Hello!".to_string(),
            }],
            model: "claude-sonnet-4-5-20250929".to_string(),
            stop_reason: Some("end_turn".to_string()),
            stop_sequence: None,
            usage: Usage {
                input_tokens: 10,
                output_tokens: 20,
            },
        };
        let json_str = serde_json::to_string(&response).unwrap();
        let deserialized: LlmResponse = serde_json::from_str(&json_str).unwrap();
        assert_eq!(deserialized.id, response.id);
        assert_eq!(deserialized.content.len(), 1);
        assert_eq!(deserialized.content[0].text, "Hello!");
        assert_eq!(deserialized.usage.input_tokens, 10);
        assert_eq!(deserialized.usage.output_tokens, 20);
    }

    #[test]
    fn test_llm_response_multiple_content_blocks() {
        let json = r#"{
            "id": "msg_multi",
            "type": "message",
            "role": "assistant",
            "content": [
                { "type": "text", "text": "First block." },
                { "type": "text", "text": "Second block." }
            ],
            "model": "claude-sonnet-4-5-20250929",
            "stop_reason": "end_turn",
            "usage": {
                "input_tokens": 5,
                "output_tokens": 10
            }
        }"#;
        let response: LlmResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.content.len(), 2);
        assert_eq!(response.content[0].text, "First block.");
        assert_eq!(response.content[1].text, "Second block.");
    }

    #[test]
    fn test_llm_response_stop_reason_max_tokens() {
        let json = r#"{
            "id": "msg_maxed",
            "type": "message",
            "role": "assistant",
            "content": [{ "type": "text", "text": "Truncated response..." }],
            "model": "claude-sonnet-4-5-20250929",
            "stop_reason": "max_tokens",
            "usage": { "input_tokens": 100, "output_tokens": 4096 }
        }"#;
        let response: LlmResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.stop_reason, Some("max_tokens".to_string()));
    }

    #[test]
    fn test_llm_response_stop_sequence() {
        let json = r#"{
            "id": "msg_stopped",
            "type": "message",
            "role": "assistant",
            "content": [{ "type": "text", "text": "Output before stop" }],
            "model": "claude-sonnet-4-5-20250929",
            "stop_reason": "stop_sequence",
            "stop_sequence": "STOP",
            "usage": { "input_tokens": 10, "output_tokens": 5 }
        }"#;
        let response: LlmResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.stop_reason, Some("stop_sequence".to_string()));
        assert_eq!(response.stop_sequence, Some("STOP".to_string()));
    }

    #[test]
    fn test_content_block_serializes() {
        let block = ContentBlock {
            block_type: "text".to_string(),
            text: "Hello, world!".to_string(),
        };
        let json = serde_json::to_value(&block).unwrap();
        assert_eq!(json["type"], "text");
        assert_eq!(json["text"], "Hello, world!");
        // "block_type"ではなく"type"としてシリアライズされることを確認
        assert!(json.get("block_type").is_none());
    }

    #[test]
    fn test_message_serializes() {
        let msg = Message {
            role: "user".to_string(),
            content: "Tell me about Rust.".to_string(),
        };
        let json = serde_json::to_value(&msg).unwrap();
        assert_eq!(json["role"], "user");
        assert_eq!(json["content"], "Tell me about Rust.");
    }

    #[test]
    fn test_usage_serializes() {
        let usage = Usage {
            input_tokens: 42,
            output_tokens: 128,
        };
        let json = serde_json::to_value(&usage).unwrap();
        assert_eq!(json["input_tokens"], 42);
        assert_eq!(json["output_tokens"], 128);
    }
}
