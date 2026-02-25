use crate::github::PrInfo;

/// PRの1行表示をフォーマットする。
/// additions は緑、deletions は赤、changed_files はニュートラル色で表示。
pub fn render_pull_requests(prs: &[PrInfo]) -> Vec<String> {
    prs.iter().map(render_pr_line).collect()
}

fn render_pr_line(pr: &PrInfo) -> String {
    let state_display = match pr.state.as_str() {
        "open" => "\x1b[32mOPEN\x1b[0m",
        "merged" => "\x1b[35mMERGED\x1b[0m",
        "closed" => "\x1b[31mCLOSED\x1b[0m",
        _ => &pr.state,
    };
    format!(
        "#{} {} (@{}) [{state_display}] \x1b[32m+{}\x1b[0m \x1b[31m-{}\x1b[0m {} files",
        pr.number, pr.title, pr.author, pr.additions, pr.deletions, pr.changed_files,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::github::PrInfo;

    fn sample_pr(number: u64, additions: u64, deletions: u64, changed_files: u64) -> PrInfo {
        PrInfo {
            number,
            title: format!("PR {number}"),
            author: "alice".to_string(),
            state: "open".to_string(),
            head_branch: "feature".to_string(),
            base_branch: "main".to_string(),
            updated_at: "2025-01-15T10:30:00Z".to_string(),
            additions,
            deletions,
            changed_files,
            body: String::new(),
            html_url: format!("https://github.com/owner/repo/pull/{number}"),
        }
    }

    #[test]
    fn test_render_single_pr_contains_stats() {
        let prs = vec![sample_pr(42, 100, 20, 5)];
        let lines = render_pull_requests(&prs);
        assert_eq!(lines.len(), 1);

        let line = &lines[0];
        assert!(line.contains("#42"));
        assert!(line.contains("PR 42"));
        assert!(line.contains("@alice"));
        assert!(line.contains("[\x1b[32mOPEN\x1b[0m]"));
        // additions は緑色のANSIコード付き
        assert!(line.contains("\x1b[32m+100\x1b[0m"));
        // deletions は赤色のANSIコード付き
        assert!(line.contains("\x1b[31m-20\x1b[0m"));
        assert!(line.contains("5 files"));
    }

    #[test]
    fn test_render_multiple_prs() {
        let prs = vec![
            sample_pr(1, 10, 3, 2),
            sample_pr(2, 0, 0, 0),
            sample_pr(3, 500, 200, 50),
        ];
        let lines = render_pull_requests(&prs);
        assert_eq!(lines.len(), 3);

        assert!(lines[0].contains("#1"));
        assert!(lines[1].contains("#2"));
        assert!(lines[2].contains("#3"));
    }

    #[test]
    fn test_render_empty_list() {
        let lines = render_pull_requests(&[]);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_render_zero_stats() {
        let prs = vec![sample_pr(99, 0, 0, 0)];
        let lines = render_pull_requests(&prs);
        let line = &lines[0];
        assert!(line.contains("\x1b[32m+0\x1b[0m"));
        assert!(line.contains("\x1b[31m-0\x1b[0m"));
        assert!(line.contains("0 files"));
    }

    #[test]
    fn test_render_additions_green_deletions_red() {
        let prs = vec![sample_pr(1, 42, 13, 3)];
        let lines = render_pull_requests(&prs);
        let line = &lines[0];
        // 緑色 (ANSI 32) で additions が表示される
        assert!(line.contains("\x1b[32m+42\x1b[0m"));
        // 赤色 (ANSI 31) で deletions が表示される
        assert!(line.contains("\x1b[31m-13\x1b[0m"));
    }

    fn sample_pr_with_state(number: u64, state: &str) -> PrInfo {
        PrInfo {
            number,
            title: format!("PR {number}"),
            author: "alice".to_string(),
            state: state.to_string(),
            head_branch: "feature".to_string(),
            base_branch: "main".to_string(),
            updated_at: "2025-01-15T10:30:00Z".to_string(),
            additions: 10,
            deletions: 5,
            changed_files: 2,
            body: String::new(),
            html_url: format!("https://github.com/owner/repo/pull/{number}"),
        }
    }

    #[test]
    fn test_render_merged_pr_purple() {
        let prs = vec![sample_pr_with_state(10, "merged")];
        let lines = render_pull_requests(&prs);
        let line = &lines[0];
        // 紫色 (ANSI 35) で MERGED が表示される
        assert!(line.contains("[\x1b[35mMERGED\x1b[0m]"));
    }

    #[test]
    fn test_render_closed_pr_red() {
        let prs = vec![sample_pr_with_state(20, "closed")];
        let lines = render_pull_requests(&prs);
        let line = &lines[0];
        // 赤色 (ANSI 31) で CLOSED が表示される
        assert!(line.contains("[\x1b[31mCLOSED\x1b[0m]"));
    }

    #[test]
    fn test_render_open_pr_green() {
        let prs = vec![sample_pr_with_state(30, "open")];
        let lines = render_pull_requests(&prs);
        let line = &lines[0];
        // 緑色 (ANSI 32) で OPEN が表示される
        assert!(line.contains("[\x1b[32mOPEN\x1b[0m]"));
    }
}
