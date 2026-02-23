use crate::github::PrInfo;
use ratatui::{
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, ListState},
    Frame,
};

/// Render the pull requests panel into `area`.
pub fn render_pull_requests(
    frame: &mut Frame,
    area: Rect,
    pull_requests: &[PrInfo],
    selected: usize,
    focused: bool,
) {
    let border_style = if focused {
        Style::default().fg(Color::Cyan)
    } else {
        Style::default()
    };

    let items: Vec<ListItem> = pull_requests
        .iter()
        .map(|pr| {
            let state_style = match pr.state.as_str() {
                "open" => Style::default().fg(Color::Green),
                "closed" => Style::default().fg(Color::Red),
                _ => Style::default().fg(Color::Yellow),
            };
            let number = format!("#{:<5}", pr.number);
            let title = if pr.title.len() > 50 {
                format!("{}…", &pr.title[..49])
            } else {
                format!("{:<50}", pr.title)
            };
            let author = format!("  @{}", pr.author);
            let line = Line::from(vec![
                Span::styled(number, Style::default().fg(Color::Cyan)),
                Span::styled(
                    format!(" {} ", pr.state.to_uppercase()),
                    state_style,
                ),
                Span::styled(title, Style::default().fg(Color::White)),
                Span::styled(author, Style::default().fg(Color::DarkGray)),
            ]);
            ListItem::new(line)
        })
        .collect();

    let mut state = ListState::default();
    state.select(Some(selected));

    let list = List::new(items)
        .block(
            Block::default()
                .title(" Pull Requests [p] ")
                .borders(Borders::ALL)
                .border_style(border_style),
        )
        .highlight_style(
            Style::default()
                .bg(Color::DarkGray)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol("▶ ");

    frame.render_stateful_widget(list, area, &mut state);
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::{backend::TestBackend, Terminal};

    fn sample_prs() -> Vec<PrInfo> {
        vec![
            PrInfo {
                number: 42,
                title: "Add feature X".to_string(),
                author: "alice".to_string(),
                state: "open".to_string(),
                head_branch: "feature-x".to_string(),
                updated_at: "2025-01-15T10:30:00Z".to_string(),
                additions: 100,
                deletions: 20,
                changed_files: 5,
            },
            PrInfo {
                number: 43,
                title: "Fix bug Y".to_string(),
                author: "bob".to_string(),
                state: "closed".to_string(),
                head_branch: "fix-bug-y".to_string(),
                updated_at: "2025-01-16T08:00:00Z".to_string(),
                additions: 10,
                deletions: 3,
                changed_files: 2,
            },
        ]
    }

    #[test]
    fn test_render_pull_requests_no_panic() {
        let backend = TestBackend::new(80, 24);
        let mut terminal = Terminal::new(backend).unwrap();
        let prs = sample_prs();

        terminal
            .draw(|frame| {
                let area = frame.area();
                render_pull_requests(frame, area, &prs, 0, true);
            })
            .unwrap();
    }

    #[test]
    fn test_render_empty_pull_requests_no_panic() {
        let backend = TestBackend::new(80, 24);
        let mut terminal = Terminal::new(backend).unwrap();

        terminal
            .draw(|frame| {
                let area = frame.area();
                render_pull_requests(frame, area, &[], 0, false);
            })
            .unwrap();
    }

    #[test]
    fn test_render_pull_requests_contains_pr_number() {
        let backend = TestBackend::new(100, 24);
        let mut terminal = Terminal::new(backend).unwrap();
        let prs = sample_prs();

        let result = terminal
            .draw(|frame| {
                let area = frame.area();
                render_pull_requests(frame, area, &prs, 0, true);
            })
            .unwrap();

        let buffer = result.buffer;
        let content: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol().chars().next().unwrap_or(' '))
            .collect();

        assert!(content.contains("#42"));
        assert!(content.contains("#43"));
        assert!(content.contains("alice"));
        assert!(content.contains("bob"));
    }

    #[test]
    fn test_render_long_title_truncated() {
        let backend = TestBackend::new(100, 24);
        let mut terminal = Terminal::new(backend).unwrap();
        let prs = vec![PrInfo {
            number: 1,
            title: "A very long title that exceeds fifty characters and should be truncated with an ellipsis".to_string(),
            author: "dev".to_string(),
            state: "open".to_string(),
            head_branch: "long-branch".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
            additions: 0,
            deletions: 0,
            changed_files: 0,
        }];

        terminal
            .draw(|frame| {
                let area = frame.area();
                render_pull_requests(frame, area, &prs, 0, true);
            })
            .unwrap();
    }
}
