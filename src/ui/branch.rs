use crate::git::branch::BranchInfo;
use ratatui::{
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, ListState},
    Frame,
};

/// Render the branch panel into `area`.
pub fn render_branches(
    frame: &mut Frame,
    area: Rect,
    branches: &[BranchInfo],
    selected: usize,
    focused: bool,
) {
    let border_style = if focused {
        Style::default().fg(Color::Cyan)
    } else {
        Style::default()
    };

    let items: Vec<ListItem> = branches
        .iter()
        .map(|b| {
            let head_marker = if b.is_head { "* " } else { "  " };
            let upstream_label = b
                .upstream
                .as_deref()
                .map(|u| format!("  ↑ {u}"))
                .unwrap_or_default();
            let display_name = if b.name.len() > 32 {
                format!("{}…", &b.name[..31])
            } else {
                format!("{:<32}", b.name)
            };
            let line = Line::from(vec![
                Span::styled(head_marker, Style::default().fg(Color::Green)),
                Span::styled(display_name, Style::default().fg(Color::Yellow)),
                Span::styled(upstream_label, Style::default().fg(Color::DarkGray)),
            ]);
            ListItem::new(line)
        })
        .collect();

    let mut state = ListState::default();
    state.select(Some(selected));

    let list = List::new(items)
        .block(
            Block::default()
                .title(" Branches [b]  (c)reate  (x)delete  (↵)switch ")
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
