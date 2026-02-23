use reown::git::worktree::WorktreeInfo;
use reown::i18n;
use ratatui::{
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, ListState},
    Frame,
};

/// Render the worktree panel into `area`.
pub fn render_worktrees(
    frame: &mut Frame,
    area: Rect,
    worktrees: &[WorktreeInfo],
    selected: usize,
    focused: bool,
) {
    let border_style = if focused {
        Style::default().fg(Color::Cyan)
    } else {
        Style::default()
    };

    let items: Vec<ListItem> = worktrees
        .iter()
        .map(|wt| {
            let lock_icon = if wt.is_locked { "🔒 " } else { "   " };
            let branch_label = wt
                .branch
                .as_deref()
                .unwrap_or(i18n::WORKTREE_DETACHED_HEAD);
            let path_str = wt.path.to_string_lossy();
            let display_name = if wt.name.len() > 24 {
                format!("{}…", &wt.name[..23])
            } else {
                format!("{:<24}", wt.name)
            };
            let display_branch = if branch_label.len() > 28 {
                format!("{}…", &branch_label[..27])
            } else {
                format!("{:<28}", branch_label)
            };
            let line = Line::from(vec![
                Span::raw(lock_icon),
                Span::styled(display_name, Style::default().fg(Color::Yellow)),
                Span::styled(display_branch, Style::default().fg(Color::Green)),
                Span::raw(path_str.to_string()),
            ]);
            ListItem::new(line)
        })
        .collect();

    let mut state = ListState::default();
    state.select(Some(selected));

    let list = List::new(items)
        .block(
            Block::default()
                .title(i18n::WORKTREE_TITLE)
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
