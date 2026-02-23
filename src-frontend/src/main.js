// ── Tauri invoke ヘルパー ───────────────────────────────────────────

async function invoke(command, args) {
  if (!window.__TAURI__) {
    throw new Error("Tauri API not available (running in browser)");
  }
  return window.__TAURI__.core.invoke(command, args);
}

// ── Worktree管理 ───────────────────────────────────────────────────

async function loadWorktrees() {
  const container = document.getElementById("worktree-list");
  try {
    const worktrees = await invoke("list_worktrees");
    if (worktrees.length === 0) {
      container.innerHTML = '<p class="empty">ワークツリーがありません。</p>';
      return;
    }
    container.innerHTML = "";
    for (const wt of worktrees) {
      const div = document.createElement("div");
      div.className = "wt-item";

      let nameHtml = `<span class="wt-name${wt.is_main ? " main" : ""}">${escapeHtml(wt.name)}</span>`;
      if (wt.is_locked) {
        nameHtml += '<span class="wt-badge locked">locked</span>';
      }

      const branch = wt.branch ? escapeHtml(wt.branch) : "(detached)";
      const path = escapeHtml(wt.path);

      div.innerHTML = `
        ${nameHtml}
        <div class="wt-detail">ブランチ: ${branch}</div>
        <div class="wt-detail">パス: ${path}</div>
      `;
      container.appendChild(div);
    }
  } catch (err) {
    container.innerHTML = `<p class="error">エラー: ${escapeHtml(String(err))}</p>`;
  }
}

function setupWorktreeForm() {
  const form = document.getElementById("worktree-form");
  const msg = document.getElementById("worktree-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pathInput = document.getElementById("wt-path");
    const branchInput = document.getElementById("wt-branch");
    const submitBtn = form.querySelector('button[type="submit"]');

    const wtPath = pathInput.value.trim();
    const branch = branchInput.value.trim();
    if (!wtPath || !branch) return;

    submitBtn.disabled = true;
    msg.textContent = "";
    msg.className = "message";

    try {
      await invoke("add_worktree", { worktreePath: wtPath, branch: branch });
      msg.textContent = "ワークツリーを作成しました。";
      msg.className = "message success";
      pathInput.value = "";
      branchInput.value = "";
      await loadWorktrees();
    } catch (err) {
      msg.textContent = `エラー: ${err}`;
      msg.className = "message error";
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ── Branch管理 ────────────────────────────────────────────────────

async function loadBranches() {
  const container = document.getElementById("branch-list");
  try {
    const branches = await invoke("list_branches");
    if (branches.length === 0) {
      container.innerHTML = '<p class="empty">ブランチがありません。</p>';
      return;
    }
    container.innerHTML = "";
    for (const b of branches) {
      const div = document.createElement("div");
      div.className = "branch-item";

      const infoDiv = document.createElement("div");
      infoDiv.className = "branch-info";

      const nameSpan = document.createElement("div");
      nameSpan.className = `branch-name${b.is_head ? " head" : ""}`;
      nameSpan.textContent = b.is_head ? `* ${b.name}` : b.name;
      infoDiv.appendChild(nameSpan);

      if (b.upstream) {
        const upstreamDiv = document.createElement("div");
        upstreamDiv.className = "branch-upstream";
        upstreamDiv.textContent = `upstream: ${b.upstream}`;
        infoDiv.appendChild(upstreamDiv);
      }

      div.appendChild(infoDiv);

      // アクションボタン（HEADブランチ以外に表示）
      if (!b.is_head) {
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "branch-actions";

        const switchBtn = document.createElement("button");
        switchBtn.className = "btn btn-secondary btn-small";
        switchBtn.textContent = "切替";
        switchBtn.addEventListener("click", () => handleSwitchBranch(b.name));
        actionsDiv.appendChild(switchBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-danger btn-small";
        deleteBtn.textContent = "削除";
        deleteBtn.addEventListener("click", () => handleDeleteBranch(b.name));
        actionsDiv.appendChild(deleteBtn);

        div.appendChild(actionsDiv);
      }

      container.appendChild(div);
    }
  } catch (err) {
    container.innerHTML = `<p class="error">エラー: ${escapeHtml(String(err))}</p>`;
  }
}

function setupBranchForm() {
  const form = document.getElementById("branch-form");
  const msg = document.getElementById("branch-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("branch-name");
    const submitBtn = form.querySelector('button[type="submit"]');

    const name = nameInput.value.trim();
    if (!name) return;

    submitBtn.disabled = true;
    msg.textContent = "";
    msg.className = "message";

    try {
      await invoke("create_branch", { name: name });
      msg.textContent = `ブランチ '${name}' を作成しました。`;
      msg.className = "message success";
      nameInput.value = "";
      await loadBranches();
    } catch (err) {
      msg.textContent = `エラー: ${err}`;
      msg.className = "message error";
    } finally {
      submitBtn.disabled = false;
    }
  });
}

async function handleSwitchBranch(name) {
  const msg = document.getElementById("branch-message");
  msg.textContent = "";
  msg.className = "message";

  try {
    await invoke("switch_branch", { name: name });
    msg.textContent = `ブランチ '${name}' に切り替えました。`;
    msg.className = "message success";
    await loadBranches();
    await loadWorktrees();
  } catch (err) {
    msg.textContent = `エラー: ${err}`;
    msg.className = "message error";
  }
}

async function handleDeleteBranch(name) {
  const confirmed = await showConfirmDialog(
    `ブランチ '${name}' を削除しますか？この操作は取り消せません。`
  );
  if (!confirmed) return;

  const msg = document.getElementById("branch-message");
  msg.textContent = "";
  msg.className = "message";

  try {
    await invoke("delete_branch", { name: name });
    msg.textContent = `ブランチ '${name}' を削除しました。`;
    msg.className = "message success";
    await loadBranches();
  } catch (err) {
    msg.textContent = `エラー: ${err}`;
    msg.className = "message error";
  }
}

// ── 確認ダイアログ ─────────────────────────────────────────────────

function showConfirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirm-dialog");
    const msgEl = document.getElementById("confirm-message");
    const cancelBtn = document.getElementById("confirm-cancel");
    const okBtn = document.getElementById("confirm-ok");

    msgEl.textContent = message;
    overlay.hidden = false;

    function cleanup() {
      overlay.hidden = true;
      cancelBtn.removeEventListener("click", onCancel);
      okBtn.removeEventListener("click", onOk);
    }

    function onCancel() {
      cleanup();
      resolve(false);
    }

    function onOk() {
      cleanup();
      resolve(true);
    }

    cancelBtn.addEventListener("click", onCancel);
    okBtn.addEventListener("click", onOk);
  });
}

// ── ユーティリティ ──────────────────────────────────────────────────

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ── 初期化 ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  setupWorktreeForm();
  setupBranchForm();
  loadWorktrees();
  loadBranches();
});
