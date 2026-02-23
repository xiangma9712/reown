mod app;
mod git;
mod github;
mod ui;

use app::{App, InputMode, View};
use anyhow::Result;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode},
};
use ratatui::{
    Terminal,
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph},
};
use std::{io, time::Duration};

fn main() -> Result<()> {
    // Determine repo path: use first CLI arg or current directory.
    let repo_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| ".".to_string());

    // Set up terminal.
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let result = run_app(&mut terminal, &repo_path);

    // Restore terminal.
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    result
}

fn run_app(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    repo_path: &str,
) -> Result<()> {
    let mut app = App::new(repo_path)?;

    loop {
        terminal.draw(|frame| draw(frame, &app))?;

        // Block until an event occurs to avoid unnecessary CPU usage from idle redraws.
        if !event::poll(Duration::from_secs(1))? {
            continue;
        }

        if let Event::Key(key) = event::read()? {
            // Ctrl-C always quits (use contains to handle multiple simultaneous modifiers)
            if key.modifiers.contains(KeyModifiers::CONTROL)
                && (key.code == KeyCode::Char('c') || key.code == KeyCode::Char('C'))
            {
                break;
            }

            match app.input_mode {
                InputMode::NewBranch | InputMode::NewWorktree => {
                    match key.code {
                        KeyCode::Char(c)
                            if key.modifiers.is_empty()
                                || key.modifiers == KeyModifiers::SHIFT =>
                        {
                            app.input_buf.push(c)
                        }
                        KeyCode::Backspace => {
                            app.input_buf.pop();
                        }
                        KeyCode::Enter => {
                            if app.input_mode == InputMode::NewBranch {
                                app.confirm_create_branch();
                            } else {
                                app.confirm_add_worktree();
                            }
                        }
                        KeyCode::Esc => {
                            app.input_mode = InputMode::Normal;
                            app.input_buf.clear();
                            app.status_msg = None;
                        }
                        _ => {}
                    }
                }
                InputMode::Normal => match key.code {
                    KeyCode::Char('q') => break,
                    // Tab switches view
                    KeyCode::Tab => {
                        app.view = match app.view {
                            View::Worktrees => View::Branches,
                            View::Branches => View::Diff,
                            View::Diff => View::PullRequests,
                            View::PullRequests => View::Worktrees,
                        };
                    }
                    // View shortcuts
                    KeyCode::Char('w') => app.view = View::Worktrees,
                    KeyCode::Char('b') => app.view = View::Branches,
                    KeyCode::Char('d') => app.view = View::Diff,
                    KeyCode::Char('p') => app.view = View::PullRequests,
                    // Navigation
                    KeyCode::Down | KeyCode::Char('j') => {
                        if app.view == View::Diff {
                            app.scroll_diff_down();
                        } else {
                            app.select_next();
                        }
                    }
                    KeyCode::Up | KeyCode::Char('k') => {
                        if app.view == View::Diff {
                            app.scroll_diff_up();
                        } else {
                            app.select_prev();
                        }
                    }
                    // File navigation in diff view
                    KeyCode::Right | KeyCode::Char('l') if app.view == View::Diff => {
                        app.select_next();
                    }
                    KeyCode::Left | KeyCode::Char('h') if app.view == View::Diff => {
                        app.select_prev();
                    }
                    // Refresh
                    KeyCode::Char('r') => {
                        app.refresh();
                        app.status_msg = Some("Refreshed.".into());
                    }
                    // Actions
                    KeyCode::Char('c') => match app.view {
                        View::Branches => {
                            app.input_mode = InputMode::NewBranch;
                            app.input_buf.clear();
                            app.status_msg = Some(
                                "New branch name (Enter to confirm, Esc to cancel):".into(),
                            );
                        }
                        View::Worktrees => {
                            app.input_mode = InputMode::NewWorktree;
                            app.input_buf.clear();
                            app.status_msg = Some(
                                "New worktree  path|branch  (Enter to confirm, Esc to cancel):"
                                    .into(),
                            );
                        }
                        View::Diff | View::PullRequests => {}
                    },
                    KeyCode::Enter => {
                        if app.view == View::Branches {
                            app.switch_selected_branch();
                        }
                    }
                    KeyCode::Delete | KeyCode::Char('x') => {
                        if app.view == View::Branches {
                            app.delete_selected_branch();
                        }
                    }
                    _ => {}
                },
            }
        }
    }

    Ok(())
}

fn draw(frame: &mut ratatui::Frame, app: &App) {
    let area = frame.area();

    // Outer vertical layout: header | main content | status bar
    let outer = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1), // header
            Constraint::Min(0),    // content
            Constraint::Length(1), // status
        ])
        .split(area);

    // ── Header ────────────────────────────────────────────────────────────
    let tab_style = |v: View| {
        if v == app.view {
            Style::default()
                .fg(Color::Black)
                .bg(Color::Cyan)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(Color::White)
        }
    };
    let header = Line::from(vec![
        Span::raw(" reown  "),
        Span::styled(" [w] Worktrees ", tab_style(View::Worktrees)),
        Span::raw(" "),
        Span::styled(" [b] Branches ", tab_style(View::Branches)),
        Span::raw(" "),
        Span::styled(" [d] Diff ", tab_style(View::Diff)),
        Span::raw(" "),
        Span::styled(" [p] PRs ", tab_style(View::PullRequests)),
        Span::raw("  ─  Tab:next  q:quit  r:refresh"),
    ]);
    frame.render_widget(
        Paragraph::new(header).style(Style::default().bg(Color::DarkGray)),
        outer[0],
    );

    // ── Main content ──────────────────────────────────────────────────────
    match app.view {
        View::Worktrees => {
            ui::worktree::render_worktrees(
                frame,
                outer[1],
                &app.worktrees,
                app.worktree_sel,
                true,
            );
        }
        View::Branches => {
            ui::branch::render_branches(
                frame,
                outer[1],
                &app.branches,
                app.branch_sel,
                true,
            );
        }
        View::Diff => {
            ui::diff::render_diff(
                frame,
                outer[1],
                &app.file_diffs,
                app.diff_file_sel,
                app.diff_scroll,
                true,
            );
        }
        View::PullRequests => {
            ui::pull_request::render_pull_requests(
                frame,
                outer[1],
                &app.pull_requests,
                app.pr_sel,
                true,
            );
        }
    }

    // ── Status bar / input ────────────────────────────────────────────────
    let status_content = match app.input_mode {
        InputMode::Normal => {
            let msg = app.status_msg.as_deref().unwrap_or(
                "q:quit  Tab:switch view  ↑↓:navigate  c:create  x/Del:delete  ↵:confirm",
            );
            Line::from(Span::styled(msg, Style::default().fg(Color::White)))
        }
        InputMode::NewBranch | InputMode::NewWorktree => {
            let prompt = app.status_msg.as_deref().unwrap_or("Input:");
            Line::from(vec![
                Span::styled(format!("{prompt} "), Style::default().fg(Color::Yellow)),
                Span::styled(app.input_buf.clone(), Style::default().fg(Color::White)),
                Span::styled("█", Style::default().fg(Color::White)),
            ])
        }
    };
    frame.render_widget(
        Paragraph::new(status_content)
            .block(Block::default().borders(Borders::NONE))
            .style(Style::default().bg(Color::DarkGray)),
        outer[2],
    );
}

