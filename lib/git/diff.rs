use anyhow::{Context, Result};
use git2::Delta;

use super::open_repo;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub enum LineOrigin {
    Addition,
    Deletion,
    Context,
    Other(char),
}

impl From<char> for LineOrigin {
    fn from(c: char) -> Self {
        match c {
            '+' => LineOrigin::Addition,
            '-' => LineOrigin::Deletion,
            ' ' => LineOrigin::Context,
            other => LineOrigin::Other(other),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DiffLineInfo {
    pub origin: LineOrigin,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
    pub content: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DiffChunk {
    pub header: String,
    pub lines: Vec<DiffLineInfo>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FileDiff {
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub status: FileStatus,
    pub chunks: Vec<DiffChunk>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub enum FileStatus {
    Added,
    Deleted,
    Modified,
    Renamed,
    Other,
}

impl From<Delta> for FileStatus {
    fn from(d: Delta) -> Self {
        match d {
            Delta::Added => FileStatus::Added,
            Delta::Deleted => FileStatus::Deleted,
            Delta::Modified => FileStatus::Modified,
            Delta::Renamed => FileStatus::Renamed,
            _ => FileStatus::Other,
        }
    }
}

/// Return the diff of the working directory against HEAD.
pub fn diff_workdir(repo_path: &str) -> Result<Vec<FileDiff>> {
    let repo = open_repo(repo_path)?;

    let head_tree = match repo.head() {
        Ok(head) => Some(head.peel_to_tree()?),
        Err(_) => None, // unborn repo
    };

    let diff = repo
        .diff_tree_to_workdir_with_index(head_tree.as_ref(), None)
        .context("Failed to compute workdir diff")?;

    collect_diff(&diff)
}

/// Return the diff introduced by `commit_sha` relative to its first parent.
#[allow(dead_code)] // used in Phase 2 for PR diff display
pub fn diff_commit(repo_path: &str, commit_sha: &str) -> Result<Vec<FileDiff>> {
    let repo = open_repo(repo_path)?;

    let oid = repo
        .revparse_single(commit_sha)
        .with_context(|| format!("Commit '{commit_sha}' not found"))?
        .id();

    let commit = repo.find_commit(oid)?;
    let commit_tree = commit.tree()?;

    let parent_tree = commit.parent(0).ok().map(|p| p.tree()).transpose()?;

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)
        .context("Failed to compute commit diff")?;

    collect_diff(&diff)
}

// ── internals ────────────────────────────────────────────────────────────────

fn collect_diff(diff: &git2::Diff<'_>) -> Result<Vec<FileDiff>> {
    let mut files = Vec::new();

    for (idx, delta) in diff.deltas().enumerate() {
        let mut file_diff = FileDiff {
            old_path: delta
                .old_file()
                .path()
                .map(|p| p.to_string_lossy().into_owned()),
            new_path: delta
                .new_file()
                .path()
                .map(|p| p.to_string_lossy().into_owned()),
            status: delta.status().into(),
            chunks: Vec::new(),
        };

        let patch =
            git2::Patch::from_diff(diff, idx).context("Failed to create patch from diff")?;
        let patch = match patch {
            Some(p) => p,
            None => {
                files.push(file_diff);
                continue;
            }
        };

        for hunk_idx in 0..patch.num_hunks() {
            let (hunk, line_count) = patch.hunk(hunk_idx)?;
            let header = std::str::from_utf8(hunk.header())
                .unwrap_or("")
                .trim_end()
                .to_string();

            let mut chunk = DiffChunk {
                header,
                lines: Vec::new(),
            };

            for line_idx in 0..line_count {
                let line = patch.line_in_hunk(hunk_idx, line_idx)?;
                let content = std::str::from_utf8(line.content())
                    .unwrap_or("")
                    .to_string();
                chunk.lines.push(DiffLineInfo {
                    origin: LineOrigin::from(line.origin()),
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                    content,
                });
            }

            file_diff.chunks.push(chunk);
        }

        files.push(file_diff);
    }

    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_utils::init_repo_with_commit;
    use git2::Signature;
    use std::fs;

    #[test]
    fn test_diff_workdir_clean() {
        let (dir, _) = init_repo_with_commit();
        let diffs = diff_workdir(dir.path().to_str().unwrap()).unwrap();
        assert!(diffs.is_empty(), "clean workdir should produce no diff");
    }

    #[test]
    fn test_diff_workdir_modified_file() {
        let (dir, _) = init_repo_with_commit();
        fs::write(dir.path().join("hello.txt"), "hello\nworld\n").unwrap();
        let diffs = diff_workdir(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(diffs.len(), 1);
        assert_eq!(diffs[0].new_path.as_deref(), Some("hello.txt"));
        assert_eq!(diffs[0].status, FileStatus::Modified);
    }

    #[test]
    fn test_diff_commit() {
        let (dir, repo) = init_repo_with_commit();

        // Second commit modifying the file.
        fs::write(dir.path().join("hello.txt"), "hello\nworld\n").unwrap();
        let sig = Signature::now("Test", "test@test.com").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("hello.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        let oid = {
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "update", &tree, &[&parent])
                .unwrap()
        };

        let diffs = diff_commit(dir.path().to_str().unwrap(), &oid.to_string()).unwrap();
        assert_eq!(diffs.len(), 1);
        assert_eq!(diffs[0].status, FileStatus::Modified);
        // Should have at least one chunk with an added line.
        let has_addition = diffs[0]
            .chunks
            .iter()
            .flat_map(|c| &c.lines)
            .any(|l| l.origin == LineOrigin::Addition);
        assert!(has_addition);
    }

    #[test]
    fn test_line_origin_from_char() {
        assert_eq!(LineOrigin::from('+'), LineOrigin::Addition);
        assert_eq!(LineOrigin::from('-'), LineOrigin::Deletion);
        assert_eq!(LineOrigin::from(' '), LineOrigin::Context);
    }
}
