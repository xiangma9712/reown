use reown::git::{
    branch::{self, BranchInfo},
    diff::{self, FileDiff},
    worktree::{self, WorktreeInfo},
};
use reown::github::PrInfo;
use reown::i18n;
use anyhow::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum View {
    Worktrees,
    Branches,
    Diff,
    PullRequests,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputMode {
    Normal,
    /// Collecting a name for a new branch
    NewBranch,
    /// Collecting path + branch for a new worktree
    NewWorktree,
}

pub struct App {
    pub repo_path: String,
    pub view: View,
    pub input_mode: InputMode,
    pub input_buf: String,
    pub status_msg: Option<String>,

    // Worktree tab
    pub worktrees: Vec<WorktreeInfo>,
    pub worktree_sel: usize,

    // Branch tab
    pub branches: Vec<BranchInfo>,
    pub branch_sel: usize,

    // Diff tab
    pub file_diffs: Vec<FileDiff>,
    pub diff_file_sel: usize,
    pub diff_scroll: u16,

    // Pull Requests tab
    pub pull_requests: Vec<PrInfo>,
    pub pr_sel: usize,
}

impl App {
    pub fn new(repo_path: &str) -> Result<Self> {
        let mut errors = Vec::new();

        let worktrees = match worktree::list_worktrees(repo_path) {
            Ok(ws) => ws,
            Err(e) => {
                errors.push(format!("Failed to list worktrees: {e}"));
                Vec::new()
            }
        };

        let branches = match branch::list_branches(repo_path) {
            Ok(bs) => bs,
            Err(e) => {
                errors.push(format!("Failed to list branches: {e}"));
                Vec::new()
            }
        };

        let file_diffs = match diff::diff_workdir(repo_path) {
            Ok(ds) => ds,
            Err(e) => {
                errors.push(format!("Failed to compute workdir diff: {e}"));
                Vec::new()
            }
        };

        let status_msg = if errors.is_empty() {
            None
        } else {
            Some(errors.join(" | "))
        };

        Ok(Self {
            repo_path: repo_path.to_string(),
            view: View::Worktrees,
            input_mode: InputMode::Normal,
            input_buf: String::new(),
            status_msg,
            worktrees,
            worktree_sel: 0,
            branches,
            branch_sel: 0,
            file_diffs,
            diff_file_sel: 0,
            diff_scroll: 0,
            pull_requests: Vec::new(),
            pr_sel: 0,
        })
    }

    pub fn refresh(&mut self) {
        self.status_msg = None;
        let mut errors = Vec::new();

        match worktree::list_worktrees(&self.repo_path) {
            Ok(ws) => self.worktrees = ws,
            Err(e) => {
                self.worktrees = Vec::new();
                errors.push(format!("Failed to refresh worktrees: {e}"));
            }
        }

        match branch::list_branches(&self.repo_path) {
            Ok(bs) => self.branches = bs,
            Err(e) => {
                self.branches = Vec::new();
                errors.push(format!("Failed to refresh branches: {e}"));
            }
        }

        match diff::diff_workdir(&self.repo_path) {
            Ok(ds) => self.file_diffs = ds,
            Err(e) => {
                self.file_diffs = Vec::new();
                errors.push(format!("Failed to refresh diff: {e}"));
            }
        }

        if !errors.is_empty() {
            self.status_msg = Some(errors.join(" | "));
        }

        self.diff_scroll = 0;
        self.clamp_selections();
    }

    fn clamp_selections(&mut self) {
        let wt_len = self.worktrees.len();
        if wt_len == 0 {
            self.worktree_sel = 0;
        } else if self.worktree_sel >= wt_len {
            self.worktree_sel = wt_len - 1;
        }

        let b_len = self.branches.len();
        if b_len == 0 {
            self.branch_sel = 0;
        } else if self.branch_sel >= b_len {
            self.branch_sel = b_len - 1;
        }

        let d_len = self.file_diffs.len();
        if d_len == 0 {
            self.diff_file_sel = 0;
        } else if self.diff_file_sel >= d_len {
            self.diff_file_sel = d_len - 1;
        }

        let pr_len = self.pull_requests.len();
        if pr_len == 0 {
            self.pr_sel = 0;
        } else if self.pr_sel >= pr_len {
            self.pr_sel = pr_len - 1;
        }
    }

    // ── Navigation ────────────────────────────────────────────────────────

    pub fn select_next(&mut self) {
        match self.view {
            View::Worktrees => {
                if !self.worktrees.is_empty() {
                    self.worktree_sel = (self.worktree_sel + 1).min(self.worktrees.len() - 1);
                }
            }
            View::Branches => {
                if !self.branches.is_empty() {
                    self.branch_sel = (self.branch_sel + 1).min(self.branches.len() - 1);
                }
            }
            View::Diff => {
                if !self.file_diffs.is_empty() {
                    self.diff_file_sel =
                        (self.diff_file_sel + 1).min(self.file_diffs.len() - 1);
                    self.diff_scroll = 0;
                }
            }
            View::PullRequests => {
                if !self.pull_requests.is_empty() {
                    self.pr_sel = (self.pr_sel + 1).min(self.pull_requests.len() - 1);
                }
            }
        }
    }

    pub fn select_prev(&mut self) {
        match self.view {
            View::Worktrees => {
                self.worktree_sel = self.worktree_sel.saturating_sub(1);
            }
            View::Branches => {
                self.branch_sel = self.branch_sel.saturating_sub(1);
            }
            View::Diff => {
                self.diff_file_sel = self.diff_file_sel.saturating_sub(1);
                self.diff_scroll = 0;
            }
            View::PullRequests => {
                self.pr_sel = self.pr_sel.saturating_sub(1);
            }
        }
    }

    pub fn scroll_diff_down(&mut self) {
        self.diff_scroll = self.diff_scroll.saturating_add(1);
    }

    pub fn scroll_diff_up(&mut self) {
        self.diff_scroll = self.diff_scroll.saturating_sub(1);
    }

    // ── Actions ───────────────────────────────────────────────────────────

    /// Create a branch with the name currently in `input_buf`.
    pub fn confirm_create_branch(&mut self) {
        let name = self.input_buf.trim().to_string();
        if name.is_empty() {
            self.status_msg = Some(i18n::BRANCH_NAME_EMPTY.into());
        } else {
            match branch::create_branch(&self.repo_path, &name) {
                Ok(()) => {
                    self.status_msg = Some(i18n::branch_created(&name));
                    self.refresh();
                }
                Err(e) => {
                    self.status_msg = Some(i18n::error_msg(&e));
                }
            }
        }
        self.input_mode = InputMode::Normal;
        self.input_buf.clear();
    }

    /// Switch to the currently selected branch.
    pub fn switch_selected_branch(&mut self) {
        if let Some(b) = self.branches.get(self.branch_sel) {
            let name = b.name.clone();
            match branch::switch_branch(&self.repo_path, &name) {
                Ok(()) => {
                    self.status_msg = Some(i18n::branch_switched(&name));
                    self.refresh();
                }
                Err(e) => {
                    self.status_msg = Some(i18n::error_msg(&e));
                }
            }
        }
    }

    /// Delete the currently selected branch.
    pub fn delete_selected_branch(&mut self) {
        if let Some(b) = self.branches.get(self.branch_sel) {
            let name = b.name.clone();
            match branch::delete_branch(&self.repo_path, &name) {
                Ok(()) => {
                    self.status_msg = Some(i18n::branch_deleted(&name));
                    self.refresh();
                }
                Err(e) => {
                    self.status_msg = Some(i18n::error_msg(&e));
                }
            }
        }
    }

    /// Add a worktree. `input_buf` format: `<path>|<branch>`.
    /// Note: pipe `|` is used as delimiter. Paths should be relative to avoid
    /// ambiguity since `|` can technically appear in Unix paths.
    pub fn confirm_add_worktree(&mut self) {
        let raw = self.input_buf.trim().to_string();
        let parts: Vec<&str> = raw.splitn(2, '|').collect();
        if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
            self.status_msg = Some(i18n::WORKTREE_FORMAT_HINT.into());
        } else {
            let wt_path = parts[0].trim();
            let branch = parts[1].trim();
            match worktree::add_worktree(&self.repo_path, wt_path, branch) {
                Ok(()) => {
                    self.status_msg = Some(i18n::worktree_added(wt_path, branch));
                    self.refresh();
                }
                Err(e) => {
                    self.status_msg = Some(i18n::error_msg(&e));
                }
            }
        }
        self.input_mode = InputMode::Normal;
        self.input_buf.clear();
    }
}
