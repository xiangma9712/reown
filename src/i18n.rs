//! UI テキスト定数モジュール
//!
//! アプリケーション内の全UIテキストをこのモジュールに集約する。
//! 現段階では日本語のみ。将来的にlocale切り替え可能な設計にする。

// ── ヘッダー ─────────────────────────────────────────────────────────────
pub const HEADER_APP_NAME: &str = " reown  ";
pub const HEADER_TAB_WORKTREES: &str = " [w] ワークツリー ";
pub const HEADER_TAB_BRANCHES: &str = " [b] ブランチ ";
pub const HEADER_TAB_DIFF: &str = " [d] 差分 ";
pub const HEADER_TAB_PRS: &str = " [p] PR ";
pub const HEADER_HELP: &str = "  ─  Tab:次へ  q:終了  r:更新";

// ── ステータスバー ───────────────────────────────────────────────────────
pub const STATUS_DEFAULT: &str =
    "q:終了  Tab:ビュー切替  ↑↓:移動  c:作成  x/Del:削除  ↵:確定";
pub const STATUS_INPUT_PROMPT: &str = "入力:";
pub const STATUS_REFRESHED: &str = "更新しました";

// ── ブランチ ─────────────────────────────────────────────────────────────
pub const BRANCH_TITLE: &str = " ブランチ [b]  (c)作成  (x)削除  (↵)切替 ";
pub const BRANCH_PROMPT_NEW: &str = "新しいブランチ名 (Enter で確定、Esc でキャンセル):";
pub const BRANCH_NAME_EMPTY: &str = "ブランチ名を入力してください";

pub fn branch_created(name: &str) -> String {
    format!("ブランチ '{name}' を作成しました")
}

pub fn branch_switched(name: &str) -> String {
    format!("ブランチ '{name}' に切り替えました")
}

pub fn branch_deleted(name: &str) -> String {
    format!("ブランチ '{name}' を削除しました")
}

// ── ワークツリー ─────────────────────────────────────────────────────────
pub const WORKTREE_TITLE: &str = " ワークツリー [w] ";
pub const WORKTREE_DETACHED_HEAD: &str = "(デタッチド HEAD)";
pub const WORKTREE_PROMPT_NEW: &str =
    "新しいワークツリー パス|ブランチ (Enter で確定、Esc でキャンセル):";
pub const WORKTREE_FORMAT_HINT: &str = "形式: <パス>|<ブランチ>";

pub fn worktree_added(wt_path: &str, branch: &str) -> String {
    format!("ワークツリー '{branch}' を '{wt_path}' に追加しました")
}

// ── Diff ─────────────────────────────────────────────────────────────────
pub const DIFF_FILES_TITLE: &str = " ファイル ";
pub const DIFF_CONTENT_TITLE: &str = " 差分  (↑↓)スクロール  [d] ";
pub const DIFF_NO_FILE_SELECTED: &str = "(ファイル未選択)";
pub const DIFF_UNKNOWN_PATH: &str = "(不明)";

// ── プルリクエスト ───────────────────────────────────────────────────────
pub const PR_TITLE: &str = " プルリクエスト [p] ";

// ── エラー ───────────────────────────────────────────────────────────────
pub fn error_msg(e: &impl std::fmt::Display) -> String {
    format!("エラー: {e}")
}
