use std::pin::Pin;

use anyhow::Result;
use futures::stream::{Stream, StreamExt};

use super::types::{DeltaUsage, LlmResponse, MessageDeltaBody, StreamEvent, TextDelta};

/// SSEの1イベント（パース済み）
#[derive(Debug, Clone, Default)]
struct SseRawEvent {
    event: Option<String>,
    data: String,
}

/// バイトストリームからSSEイベントをパースし、`StreamEvent` のストリームを返す
///
/// `reqwest::Response::bytes_stream()` の出力を受け取り、SSE仕様に従って
/// `event:` / `data:` フィールドを処理し、空行でイベントを区切る。
pub fn parse_sse_stream(
    byte_stream: impl Stream<Item = reqwest::Result<bytes::Bytes>> + Send + 'static,
) -> Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send>> {
    Box::pin(futures::stream::unfold(
        SseParserState::new(Box::pin(byte_stream)),
        |mut state| async move {
            loop {
                let raw = state.next_raw_event().await;
                match raw {
                    None => return None,
                    Some(Err(e)) => return Some((Err(e), state)),
                    Some(Ok(raw_event)) => {
                        match parse_raw_event(&raw_event) {
                            Some(Ok(event)) => return Some((Ok(event), state)),
                            Some(Err(e)) => return Some((Err(e), state)),
                            // イベントタイプが未知の場合はスキップ
                            None => continue,
                        }
                    }
                }
            }
        },
    ))
}

/// バイトストリームを行単位に変換し、SSEイベントを組み立てる内部ステート
struct SseParserState {
    inner: Pin<Box<dyn Stream<Item = reqwest::Result<bytes::Bytes>> + Send>>,
    buffer: String,
}

impl SseParserState {
    fn new(inner: Pin<Box<dyn Stream<Item = reqwest::Result<bytes::Bytes>> + Send>>) -> Self {
        Self {
            inner,
            buffer: String::new(),
        }
    }

    /// 次のSSE rawイベントを返す。ストリーム終端で `None`。
    async fn next_raw_event(&mut self) -> Option<Result<SseRawEvent>> {
        let mut event = SseRawEvent::default();
        let mut has_content = false;

        loop {
            // バッファに完全な行があるか確認
            if let Some(pos) = self.buffer.find('\n') {
                let line = self.buffer[..pos].trim_end_matches('\r').to_string();
                self.buffer = self.buffer[pos + 1..].to_string();

                if line.is_empty() {
                    // 空行 = イベント区切り
                    if has_content {
                        return Some(Ok(event));
                    }
                    continue;
                }

                parse_sse_line(&line, &mut event);
                has_content = true;
                continue;
            }

            // バッファに完全な行がない場合、次のチャンクを読む
            match self.inner.next().await {
                Some(Ok(bytes)) => {
                    let text = String::from_utf8_lossy(&bytes);
                    self.buffer.push_str(&text);
                }
                Some(Err(e)) => {
                    return Some(Err(
                        anyhow::Error::new(e).context("SSEストリームの読み取りに失敗")
                    ));
                }
                None => {
                    // ストリーム終端 — 残りバッファに未送出イベントがあれば返す
                    if has_content {
                        // 残りの行を処理
                        if !self.buffer.is_empty() {
                            let line = std::mem::take(&mut self.buffer);
                            let line = line.trim_end_matches('\r');
                            if !line.is_empty() {
                                parse_sse_line(line, &mut event);
                            }
                        }
                        return Some(Ok(event));
                    }
                    return None;
                }
            }
        }
    }
}

/// SSEの1行をパースして `SseRawEvent` に反映する
fn parse_sse_line(line: &str, event: &mut SseRawEvent) {
    if let Some(value) = line.strip_prefix("event:") {
        event.event = Some(value.trim().to_string());
    } else if let Some(value) = line.strip_prefix("data:") {
        let value = value.trim_start();
        if !event.data.is_empty() {
            event.data.push('\n');
        }
        event.data.push_str(value);
    }
    // `id:`, `retry:`, コメント(`:`)等は無視
}

/// SSE rawイベントを `StreamEvent` に変換する
///
/// 未知のイベントタイプの場合は `None` を返す。
fn parse_raw_event(raw: &SseRawEvent) -> Option<Result<StreamEvent>> {
    let event_type = raw.event.as_deref().unwrap_or("");

    match event_type {
        "message_start" => {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(&raw.data);
            match parsed {
                Ok(v) => {
                    let message: Result<LlmResponse, _> =
                        serde_json::from_value(v["message"].clone());
                    match message {
                        Ok(msg) => Some(Ok(StreamEvent::MessageStart { message: msg })),
                        Err(e) => {
                            Some(Err(anyhow::Error::new(e)
                                .context("message_startイベントのパースに失敗")))
                        }
                    }
                }
                Err(e) => Some(Err(
                    anyhow::Error::new(e).context("message_startイベントのJSONパースに失敗")
                )),
            }
        }
        "content_block_start" => {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(&raw.data);
            match parsed {
                Ok(v) => {
                    let index = v["index"].as_u64().unwrap_or(0) as u32;
                    let content_block = serde_json::from_value(v["content_block"].clone());
                    match content_block {
                        Ok(block) => Some(Ok(StreamEvent::ContentBlockStart {
                            index,
                            content_block: block,
                        })),
                        Err(e) => Some(Err(anyhow::Error::new(e)
                            .context("content_block_startイベントのパースに失敗"))),
                    }
                }
                Err(e) => {
                    Some(Err(anyhow::Error::new(e)
                        .context("content_block_startイベントのJSONパースに失敗")))
                }
            }
        }
        "content_block_delta" => {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(&raw.data);
            match parsed {
                Ok(v) => {
                    let index = v["index"].as_u64().unwrap_or(0) as u32;
                    let delta: Result<TextDelta, _> = serde_json::from_value(v["delta"].clone());
                    match delta {
                        Ok(d) => Some(Ok(StreamEvent::ContentBlockDelta { index, delta: d })),
                        Err(e) => Some(Err(anyhow::Error::new(e)
                            .context("content_block_deltaイベントのパースに失敗"))),
                    }
                }
                Err(e) => {
                    Some(Err(anyhow::Error::new(e)
                        .context("content_block_deltaイベントのJSONパースに失敗")))
                }
            }
        }
        "content_block_stop" => {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(&raw.data);
            match parsed {
                Ok(v) => {
                    let index = v["index"].as_u64().unwrap_or(0) as u32;
                    Some(Ok(StreamEvent::ContentBlockStop { index }))
                }
                Err(e) => {
                    Some(Err(anyhow::Error::new(e)
                        .context("content_block_stopイベントのJSONパースに失敗")))
                }
            }
        }
        "message_delta" => {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(&raw.data);
            match parsed {
                Ok(v) => {
                    let delta: Result<MessageDeltaBody, _> =
                        serde_json::from_value(v["delta"].clone());
                    let usage: Result<DeltaUsage, _> = serde_json::from_value(v["usage"].clone());
                    match (delta, usage) {
                        (Ok(d), Ok(u)) => {
                            Some(Ok(StreamEvent::MessageDelta { delta: d, usage: u }))
                        }
                        (Err(e), _) | (_, Err(e)) => {
                            Some(Err(anyhow::Error::new(e)
                                .context("message_deltaイベントのパースに失敗")))
                        }
                    }
                }
                Err(e) => Some(Err(
                    anyhow::Error::new(e).context("message_deltaイベントのJSONパースに失敗")
                )),
            }
        }
        "message_stop" => Some(Ok(StreamEvent::MessageStop)),
        "ping" => Some(Ok(StreamEvent::Ping)),
        "error" => {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(&raw.data);
            match parsed {
                Ok(v) => {
                    let error_type = v["error"]["type"].as_str().unwrap_or("unknown").to_string();
                    let message = v["error"]["message"]
                        .as_str()
                        .unwrap_or("unknown error")
                        .to_string();
                    Some(Ok(StreamEvent::Error {
                        error_type,
                        message,
                    }))
                }
                Err(e) => Some(Err(
                    anyhow::Error::new(e).context("errorイベントのJSONパースに失敗")
                )),
            }
        }
        _ => None,
    }
}

/// ストリームからテキスト全体を収集するヘルパー
///
/// `ContentBlockDelta` イベントのテキストを結合して返す。
/// エラーイベントがあった場合はエラーを返す。
pub async fn collect_text(
    mut stream: Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send>>,
) -> Result<String> {
    let mut text = String::new();
    while let Some(event) = stream.next().await {
        match event? {
            StreamEvent::ContentBlockDelta { delta, .. } => {
                text.push_str(&delta.text);
            }
            StreamEvent::Error {
                error_type,
                message,
            } => {
                anyhow::bail!("ストリーミングエラー ({error_type}): {message}");
            }
            _ => {}
        }
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::Bytes;
    use futures::stream;

    /// ヘルパー: 文字列からバイトストリームを作成する
    fn bytes_stream_from_str(
        s: &str,
    ) -> impl Stream<Item = reqwest::Result<Bytes>> + Send + 'static {
        let chunks: Vec<reqwest::Result<Bytes>> = vec![Ok(Bytes::from(s.to_string()))];
        stream::iter(chunks)
    }

    /// ヘルパー: 複数チャンクからバイトストリームを作成する
    fn bytes_stream_from_chunks(
        chunks: Vec<&str>,
    ) -> impl Stream<Item = reqwest::Result<Bytes>> + Send + 'static {
        let items: Vec<reqwest::Result<Bytes>> = chunks
            .into_iter()
            .map(|s| Ok(Bytes::from(s.to_string())))
            .collect();
        stream::iter(items)
    }

    #[test]
    fn test_parse_sse_line_event() {
        let mut event = SseRawEvent::default();
        parse_sse_line("event: message_start", &mut event);
        assert_eq!(event.event, Some("message_start".to_string()));
    }

    #[test]
    fn test_parse_sse_line_data() {
        let mut event = SseRawEvent::default();
        parse_sse_line("data: {\"hello\": \"world\"}", &mut event);
        assert_eq!(event.data, "{\"hello\": \"world\"}");
    }

    #[test]
    fn test_parse_sse_line_multiline_data() {
        let mut event = SseRawEvent::default();
        parse_sse_line("data: line1", &mut event);
        parse_sse_line("data: line2", &mut event);
        assert_eq!(event.data, "line1\nline2");
    }

    #[test]
    fn test_parse_sse_line_ignores_comment() {
        let mut event = SseRawEvent::default();
        parse_sse_line(": this is a comment", &mut event);
        assert!(event.event.is_none());
        assert!(event.data.is_empty());
    }

    #[test]
    fn test_parse_raw_event_ping() {
        let raw = SseRawEvent {
            event: Some("ping".to_string()),
            data: "{}".to_string(),
        };
        let result = parse_raw_event(&raw).unwrap().unwrap();
        assert_eq!(result, StreamEvent::Ping);
    }

    #[test]
    fn test_parse_raw_event_message_stop() {
        let raw = SseRawEvent {
            event: Some("message_stop".to_string()),
            data: "{}".to_string(),
        };
        let result = parse_raw_event(&raw).unwrap().unwrap();
        assert_eq!(result, StreamEvent::MessageStop);
    }

    #[test]
    fn test_parse_raw_event_content_block_delta() {
        let raw = SseRawEvent {
            event: Some("content_block_delta".to_string()),
            data: r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}"#.to_string(),
        };
        let result = parse_raw_event(&raw).unwrap().unwrap();
        assert_eq!(
            result,
            StreamEvent::ContentBlockDelta {
                index: 0,
                delta: TextDelta {
                    delta_type: "text_delta".to_string(),
                    text: "Hello".to_string(),
                },
            }
        );
    }

    #[test]
    fn test_parse_raw_event_content_block_start() {
        let raw = SseRawEvent {
            event: Some("content_block_start".to_string()),
            data: r#"{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}"#
                .to_string(),
        };
        let result = parse_raw_event(&raw).unwrap().unwrap();
        match result {
            StreamEvent::ContentBlockStart {
                index,
                content_block,
            } => {
                assert_eq!(index, 0);
                assert_eq!(content_block.block_type, "text");
                assert_eq!(content_block.text, "");
            }
            _ => panic!("期待されるContentBlockStartではありません"),
        }
    }

    #[test]
    fn test_parse_raw_event_content_block_stop() {
        let raw = SseRawEvent {
            event: Some("content_block_stop".to_string()),
            data: r#"{"type":"content_block_stop","index":0}"#.to_string(),
        };
        let result = parse_raw_event(&raw).unwrap().unwrap();
        assert_eq!(result, StreamEvent::ContentBlockStop { index: 0 });
    }

    #[test]
    fn test_parse_raw_event_message_start() {
        let raw = SseRawEvent {
            event: Some("message_start".to_string()),
            data: r#"{"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-5-20250929","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":25,"output_tokens":1}}}"#.to_string(),
        };
        let result = parse_raw_event(&raw).unwrap().unwrap();
        match result {
            StreamEvent::MessageStart { message } => {
                assert_eq!(message.id, "msg_test");
                assert_eq!(message.role, "assistant");
                assert_eq!(message.usage.input_tokens, 25);
            }
            _ => panic!("期待されるMessageStartではありません"),
        }
    }

    #[test]
    fn test_parse_raw_event_message_delta() {
        let raw = SseRawEvent {
            event: Some("message_delta".to_string()),
            data: r#"{"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":15}}"#.to_string(),
        };
        let result = parse_raw_event(&raw).unwrap().unwrap();
        assert_eq!(
            result,
            StreamEvent::MessageDelta {
                delta: MessageDeltaBody {
                    stop_reason: Some("end_turn".to_string()),
                    stop_sequence: None,
                },
                usage: DeltaUsage { output_tokens: 15 },
            }
        );
    }

    #[test]
    fn test_parse_raw_event_error() {
        let raw = SseRawEvent {
            event: Some("error".to_string()),
            data: r#"{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}"#
                .to_string(),
        };
        let result = parse_raw_event(&raw).unwrap().unwrap();
        assert_eq!(
            result,
            StreamEvent::Error {
                error_type: "overloaded_error".to_string(),
                message: "Overloaded".to_string(),
            }
        );
    }

    #[test]
    fn test_parse_raw_event_unknown_type_returns_none() {
        let raw = SseRawEvent {
            event: Some("unknown_event".to_string()),
            data: "{}".to_string(),
        };
        assert!(parse_raw_event(&raw).is_none());
    }

    #[tokio::test]
    async fn test_parse_sse_stream_single_event() {
        let sse_data = "event: ping\ndata: {}\n\n";
        let byte_stream = bytes_stream_from_str(sse_data);
        let mut stream = parse_sse_stream(byte_stream);

        let event = stream.next().await.unwrap().unwrap();
        assert_eq!(event, StreamEvent::Ping);

        assert!(stream.next().await.is_none());
    }

    #[tokio::test]
    async fn test_parse_sse_stream_multiple_events() {
        let sse_data = concat!(
            "event: message_start\n",
            "data: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"content\":[],\"model\":\"claude-sonnet-4-5-20250929\",\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":10,\"output_tokens\":1}}}\n",
            "\n",
            "event: content_block_start\n",
            "data: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n",
            "\n",
            "event: content_block_delta\n",
            "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Hello\"}}\n",
            "\n",
            "event: content_block_delta\n",
            "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\" world\"}}\n",
            "\n",
            "event: content_block_stop\n",
            "data: {\"type\":\"content_block_stop\",\"index\":0}\n",
            "\n",
            "event: message_stop\n",
            "data: {}\n",
            "\n",
        );
        let byte_stream = bytes_stream_from_str(sse_data);
        let mut stream = parse_sse_stream(byte_stream);

        // message_start
        let event = stream.next().await.unwrap().unwrap();
        assert!(matches!(event, StreamEvent::MessageStart { .. }));

        // content_block_start
        let event = stream.next().await.unwrap().unwrap();
        assert!(matches!(event, StreamEvent::ContentBlockStart { .. }));

        // content_block_delta "Hello"
        let event = stream.next().await.unwrap().unwrap();
        match &event {
            StreamEvent::ContentBlockDelta { delta, .. } => {
                assert_eq!(delta.text, "Hello");
            }
            _ => panic!("期待されるContentBlockDeltaではありません"),
        }

        // content_block_delta " world"
        let event = stream.next().await.unwrap().unwrap();
        match &event {
            StreamEvent::ContentBlockDelta { delta, .. } => {
                assert_eq!(delta.text, " world");
            }
            _ => panic!("期待されるContentBlockDeltaではありません"),
        }

        // content_block_stop
        let event = stream.next().await.unwrap().unwrap();
        assert!(matches!(event, StreamEvent::ContentBlockStop { .. }));

        // message_stop
        let event = stream.next().await.unwrap().unwrap();
        assert_eq!(event, StreamEvent::MessageStop);

        assert!(stream.next().await.is_none());
    }

    #[tokio::test]
    async fn test_parse_sse_stream_chunked_delivery() {
        // SSEデータがチャンク境界で分割された場合のテスト
        let chunks = vec![
            "event: pi",
            "ng\ndata: {}\n\neve",
            "nt: message_stop\ndata: {}\n\n",
        ];
        let byte_stream = bytes_stream_from_chunks(chunks);
        let mut stream = parse_sse_stream(byte_stream);

        let event = stream.next().await.unwrap().unwrap();
        assert_eq!(event, StreamEvent::Ping);

        let event = stream.next().await.unwrap().unwrap();
        assert_eq!(event, StreamEvent::MessageStop);

        assert!(stream.next().await.is_none());
    }

    #[tokio::test]
    async fn test_collect_text_basic() {
        let sse_data = concat!(
            "event: content_block_delta\n",
            "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Hello\"}}\n",
            "\n",
            "event: content_block_delta\n",
            "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\" world\"}}\n",
            "\n",
            "event: message_stop\n",
            "data: {}\n",
            "\n",
        );
        let byte_stream = bytes_stream_from_str(sse_data);
        let stream = parse_sse_stream(byte_stream);

        let text = collect_text(stream).await.unwrap();
        assert_eq!(text, "Hello world");
    }

    #[tokio::test]
    async fn test_collect_text_empty_stream() {
        let sse_data = "event: message_stop\ndata: {}\n\n";
        let byte_stream = bytes_stream_from_str(sse_data);
        let stream = parse_sse_stream(byte_stream);

        let text = collect_text(stream).await.unwrap();
        assert_eq!(text, "");
    }

    #[tokio::test]
    async fn test_collect_text_error_event() {
        let sse_data = concat!(
            "event: error\n",
            "data: {\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\",\"message\":\"Overloaded\"}}\n",
            "\n",
        );
        let byte_stream = bytes_stream_from_str(sse_data);
        let stream = parse_sse_stream(byte_stream);

        let result = collect_text(stream).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("overloaded_error"));
    }

    #[tokio::test]
    async fn test_parse_sse_stream_with_ping_events() {
        let sse_data = concat!(
            "event: ping\n",
            "data: {}\n",
            "\n",
            "event: content_block_delta\n",
            "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Hi\"}}\n",
            "\n",
            "event: ping\n",
            "data: {}\n",
            "\n",
        );
        let byte_stream = bytes_stream_from_str(sse_data);
        let stream = parse_sse_stream(byte_stream);

        // collect_textはPingを無視してテキストだけ集める
        let text = collect_text(stream).await.unwrap();
        assert_eq!(text, "Hi");
    }

    #[tokio::test]
    async fn test_parse_sse_stream_realistic_anthropic_response() {
        // Anthropic APIの実際のレスポンス形式に近いテスト
        let sse_data = concat!(
            "event: message_start\n",
            "data: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_01ABC\",\"type\":\"message\",\"role\":\"assistant\",\"content\":[],\"model\":\"claude-sonnet-4-5-20250929\",\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":25,\"output_tokens\":1}}}\n",
            "\n",
            "event: content_block_start\n",
            "data: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n",
            "\n",
            "event: ping\n",
            "data: {\"type\":\"ping\"}\n",
            "\n",
            "event: content_block_delta\n",
            "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Rust\"}}\n",
            "\n",
            "event: content_block_delta\n",
            "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"は素晴らしい\"}}\n",
            "\n",
            "event: content_block_delta\n",
            "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"言語です。\"}}\n",
            "\n",
            "event: content_block_stop\n",
            "data: {\"type\":\"content_block_stop\",\"index\":0}\n",
            "\n",
            "event: message_delta\n",
            "data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":15}}\n",
            "\n",
            "event: message_stop\n",
            "data: {\"type\":\"message_stop\"}\n",
            "\n",
        );
        let byte_stream = bytes_stream_from_str(sse_data);
        let stream = parse_sse_stream(byte_stream);

        let text = collect_text(stream).await.unwrap();
        assert_eq!(text, "Rustは素晴らしい言語です。");
    }
}
