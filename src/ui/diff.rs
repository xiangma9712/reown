use reown::git::diff::{FileDiff, FileStatus, LineOrigin};
use reown::i18n;
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, ListState, Paragraph, Scrollbar, ScrollbarOrientation, ScrollbarState},
    Frame,
};

/// Render the diff view (file list + chunk/line pane) into `area`.
pub fn render_diff(
    frame: &mut Frame,
    area: Rect,
    file_diffs: &[FileDiff],
    selected_file: usize,
    scroll_offset: u16,
    focused: bool,
) {
    let border_style = if focused {
        Style::default().fg(Color::Cyan)
    } else {
        Style::default()
    };

    // Split into left file-list and right diff pane
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(25), Constraint::Percentage(75)])
        .split(area);

    // ── Left: file list ───────────────────────────────────────────────────
    let file_items: Vec<ListItem> = file_diffs
        .iter()
        .map(|fd| {
            let (status_char, color) = match fd.status {
                FileStatus::Added => ("A", Color::Green),
                FileStatus::Deleted => ("D", Color::Red),
                FileStatus::Modified => ("M", Color::Yellow),
                FileStatus::Renamed => ("R", Color::Cyan),
                FileStatus::Other => ("?", Color::DarkGray),
            };
            let name = fd
                .new_path
                .as_deref()
                .or(fd.old_path.as_deref())
                .unwrap_or(i18n::DIFF_UNKNOWN_PATH);
            let line = Line::from(vec![
                Span::styled(
                    format!("[{status_char}] "),
                    Style::default().fg(color).add_modifier(Modifier::BOLD),
                ),
                Span::raw(name),
            ]);
            ListItem::new(line)
        })
        .collect();

    let mut file_state = ListState::default();
    file_state.select(if file_diffs.is_empty() {
        None
    } else {
        Some(selected_file)
    });

    let file_list = List::new(file_items)
        .block(
            Block::default()
                .title(i18n::DIFF_FILES_TITLE)
                .borders(Borders::ALL)
                .border_style(border_style),
        )
        .highlight_style(Style::default().bg(Color::DarkGray).add_modifier(Modifier::BOLD))
        .highlight_symbol("▶ ");

    frame.render_stateful_widget(file_list, chunks[0], &mut file_state);

    // ── Right: diff content ───────────────────────────────────────────────
    let diff_lines: Vec<Line<'_>> = if let Some(fd) = file_diffs.get(selected_file) {
        fd.chunks
            .iter()
            .flat_map(|chunk| {
                let header = Line::from(Span::styled(
                    chunk.header.clone(),
                    Style::default().fg(Color::Cyan),
                ));
                let content: Vec<Line<'_>> = chunk
                    .lines
                    .iter()
                    .map(|l| {
                        let (prefix, style) = match &l.origin {
                            LineOrigin::Addition => ("+", Style::default().fg(Color::Green)),
                            LineOrigin::Deletion => ("-", Style::default().fg(Color::Red)),
                            LineOrigin::Context => (" ", Style::default()),
                            LineOrigin::Other(_) => (" ", Style::default().fg(Color::DarkGray)),
                        };
                        let old_no = l.old_lineno.map_or("    ".to_string(), |n| format!("{n:4}"));
                        let new_no = l.new_lineno.map_or("    ".to_string(), |n| format!("{n:4}"));
                        Line::from(vec![
                            Span::styled(
                                format!("{old_no} {new_no} "),
                                Style::default().fg(Color::DarkGray),
                            ),
                            Span::styled(
                                format!("{prefix}{}", l.content.trim_end_matches('\n')),
                                style,
                            ),
                        ])
                    })
                    .collect();
                std::iter::once(header).chain(content)
            })
            .collect()
    } else {
        vec![Line::from(Span::styled(
            i18n::DIFF_NO_FILE_SELECTED,
            Style::default().fg(Color::DarkGray),
        ))]
    };

    let total_lines = diff_lines.len() as u16;

    let diff_para = Paragraph::new(diff_lines)
        .block(
            Block::default()
                .title(i18n::DIFF_CONTENT_TITLE)
                .borders(Borders::ALL)
                .border_style(border_style),
        )
        .scroll((scroll_offset, 0));

    frame.render_widget(diff_para, chunks[1]);

    // Scrollbar
    let scrollbar = Scrollbar::new(ScrollbarOrientation::VerticalRight);
    let visible = chunks[1].height.saturating_sub(2); // subtract borders
    let content_len = total_lines.saturating_sub(visible) as usize;

    // If the content fits within the visible area, no scrollbar is needed.
    if content_len == 0 {
        return;
    }
    let position = (scroll_offset as usize).min(content_len);
    let mut scrollbar_state = ScrollbarState::new(content_len)
        .position(position);
    let scrollbar_area = Rect {
        x: chunks[1].x + chunks[1].width - 1,
        y: chunks[1].y + 1,
        width: 1,
        height: chunks[1].height.saturating_sub(2),
    };
    frame.render_stateful_widget(scrollbar, scrollbar_area, &mut scrollbar_state);
}
