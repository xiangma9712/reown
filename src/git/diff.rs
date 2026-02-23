use anyhow::{Context, Result};
use git2::{Delta, DiffDelta, DiffHunk, DiffLine, Repository};

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
    let repo = Repository::discover(repo_path)
        .with_context(|| format!("Failed to open repository at {repo_path}"))?;

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
    let repo = Repository::discover(repo_path)
        .with_context(|| format!("Failed to open repository at {repo_path}"))?;

    let oid = repo
        .revparse_single(commit_sha)
        .with_context(|| format!("Commit '{commit_sha}' not found"))?
        .id();

    let commit = repo.find_commit(oid)?;
    let commit_tree = commit.tree()?;

    let parent_tree = commit
        .parent(0)
        .ok()
        .map(|p| p.tree())
        .transpose()?;

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)
        .context("Failed to compute commit diff")?;

    collect_diff(&diff)
}

// ── internals ────────────────────────────────────────────────────────────────

fn collect_diff(diff: &git2::Diff<'_>) -> Result<Vec<FileDiff>> {
    use std::cell::RefCell;

    // Use RefCell to share mutable state across multiple closures passed to
    // `foreach`, which requires each closure to independently capture state.
    // TODO: Consider refactoring to a more straightforward iteration pattern
    // that builds up the data structure without needing RefCell.
    let files: RefCell<Vec<FileDiff>> = RefCell::new(Vec::new());
    let current_chunk: RefCell<Option<DiffChunk>> = RefCell::new(None);

    let flush_chunk = |files: &RefCell<Vec<FileDiff>>, current_chunk: &RefCell<Option<DiffChunk>>| {
        if let Some(chunk) = current_chunk.borrow_mut().take() {
            if let Some(f) = files.borrow_mut().last_mut() {
                f.chunks.push(chunk);
            }
        }
    };

    diff.foreach(
        &mut |delta: DiffDelta<'_>, _progress: f32| -> bool {
            flush_chunk(&files, &current_chunk);
            files.borrow_mut().push(FileDiff {
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
            });
            true
        },
        None, // binary callback
        Some(&mut |_delta: DiffDelta<'_>, hunk: DiffHunk<'_>| -> bool {
            flush_chunk(&files, &current_chunk);
            let header = std::str::from_utf8(hunk.header())
                .unwrap_or("")
                .trim_end()
                .to_string();
            *current_chunk.borrow_mut() = Some(DiffChunk {
                header,
                lines: Vec::new(),
            });
            true
        }),
        Some(&mut |_delta: DiffDelta<'_>, _hunk: Option<DiffHunk<'_>>, line: DiffLine<'_>| -> bool {
            let content = std::str::from_utf8(line.content())
                .unwrap_or("")
                .to_string();
            let info = DiffLineInfo {
                origin: LineOrigin::from(line.origin()),
                old_lineno: line.old_lineno(),
                new_lineno: line.new_lineno(),
                content,
            };
            let mut chunk_ref = current_chunk.borrow_mut();
            if let Some(ref mut chunk) = *chunk_ref {
                chunk.lines.push(info);
            } else {
                // Unexpected: line callback fired without an active chunk.
                // Fall back to appending to the last chunk of the last file.
                eprintln!("warning: diff line received without active chunk context");
                drop(chunk_ref);
                if let Some(f) = files.borrow_mut().last_mut() {
                    if let Some(c) = f.chunks.last_mut() {
                        c.lines.push(info);
                    }
                }
            }
            true
        }),
    )
    .context("Failed to iterate diff")?;

    // flush final chunk
    flush_chunk(&files, &current_chunk);

    Ok(files.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::{Repository, Signature};
    use std::fs;
    use tempfile::TempDir;

    fn init_repo_with_commit() -> (TempDir, Repository) {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();

        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@test.com").unwrap();
        drop(cfg);

        // Write and commit a file.
        fs::write(dir.path().join("hello.txt"), "hello\n").unwrap();
        let sig = Signature::now("Test", "test@test.com").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("hello.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        {
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
                .unwrap();
        }

        (dir, repo)
    }

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
