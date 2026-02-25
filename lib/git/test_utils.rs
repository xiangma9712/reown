use git2::Repository;
use std::path::Path;
use tempfile::TempDir;

/// Create a test repository with an initial empty commit.
///
/// Returns (TempDir, Repository). The TempDir must be kept alive for the
/// duration of the test to prevent the directory from being deleted.
pub fn init_test_repo() -> (TempDir, Repository) {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();

    let mut config = repo.config().unwrap();
    config.set_str("user.name", "Test").unwrap();
    config.set_str("user.email", "test@test.com").unwrap();
    drop(config);

    let sig = git2::Signature::now("Test", "test@test.com").unwrap();
    let tree_id = {
        let mut index = repo.index().unwrap();
        index.write_tree().unwrap()
    };
    {
        let tree = repo.find_tree(tree_id).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
            .unwrap();
    }

    (dir, repo)
}

/// Create a test repository with an initial commit that includes `hello.txt`.
///
/// This is useful for tests that need a tracked file in the working tree
/// (e.g. diff tests).
pub fn init_repo_with_commit() -> (TempDir, Repository) {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();

    let mut config = repo.config().unwrap();
    config.set_str("user.name", "Test").unwrap();
    config.set_str("user.email", "test@test.com").unwrap();
    config.set_str("init.defaultBranch", "main").unwrap();
    drop(config);

    // Ensure the initial branch is named "main" regardless of system git config
    repo.set_head("refs/heads/main").unwrap();

    std::fs::write(dir.path().join("hello.txt"), "hello\n").unwrap();
    let sig = git2::Signature::now("Test", "test@test.com").unwrap();
    let mut index = repo.index().unwrap();
    index.add_path(Path::new("hello.txt")).unwrap();
    index.write().unwrap();
    let tree_id = index.write_tree().unwrap();
    {
        let tree = repo.find_tree(tree_id).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
            .unwrap();
    }

    (dir, repo)
}
