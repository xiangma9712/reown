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

// ── タブ切り替え ─────────────────────────────────────────────────

const TAB_ORDER = ["worktree", "branch", "diff", "pr"];

function switchTab(tabName) {
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add("active");
  const content = document.getElementById("tab-" + tabName);
  if (content) content.classList.add("active");
}

function getActiveTab() {
  const activeBtn = document.querySelector(".tab-btn.active");
  return activeBtn ? activeBtn.getAttribute("data-tab") : TAB_ORDER[0];
}

function setupTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab"));
    });
  });
}

// ── Diff表示 ─────────────────────────────────────────────────────

let currentDiffs = [];

async function loadDiff() {
  const container = document.getElementById("diff-file-list");
  const msg = document.getElementById("diff-message");
  const btn = document.getElementById("diff-load-btn");
  msg.textContent = "";
  msg.className = "message";
  btn.disabled = true;

  try {
    currentDiffs = await invoke("diff_workdir");
    if (currentDiffs.length === 0) {
      container.innerHTML = '<p class="empty">変更ファイルがありません。</p>';
      document.getElementById("diff-content").innerHTML =
        '<p class="empty">変更がありません。</p>';
      return;
    }
    renderDiffFileList(currentDiffs);
    // 最初のファイルを自動選択
    selectDiffFile(0);
  } catch (err) {
    container.innerHTML = `<p class="error">エラー: ${escapeHtml(String(err))}</p>`;
  } finally {
    btn.disabled = false;
  }
}

function renderDiffFileList(diffs) {
  const container = document.getElementById("diff-file-list");
  container.innerHTML = "";
  diffs.forEach((diff, index) => {
    const div = document.createElement("div");
    div.className = "diff-file-item";
    div.setAttribute("data-index", index);

    const statusSpan = document.createElement("span");
    const statusText = diff.status;
    statusSpan.className = "diff-file-status " + statusText.toLowerCase();
    statusSpan.textContent = statusLabel(statusText);
    div.appendChild(statusSpan);

    const nameSpan = document.createElement("span");
    nameSpan.className = "diff-file-name";
    nameSpan.textContent = diff.new_path || diff.old_path || "(unknown)";
    nameSpan.title = diff.new_path || diff.old_path || "";
    div.appendChild(nameSpan);

    div.addEventListener("click", () => selectDiffFile(index));
    container.appendChild(div);
  });
}

function statusLabel(status) {
  switch (status) {
    case "Added": return "A";
    case "Deleted": return "D";
    case "Modified": return "M";
    case "Renamed": return "R";
    default: return "?";
  }
}

function selectDiffFile(index) {
  // ファイルリストの選択状態を更新
  document.querySelectorAll(".diff-file-item").forEach((el) => {
    el.classList.toggle("selected", parseInt(el.getAttribute("data-index")) === index);
  });

  const diff = currentDiffs[index];
  const title = document.getElementById("diff-view-title");
  title.textContent = diff.new_path || diff.old_path || "Diff";

  renderDiffContent(diff);
}

function renderDiffContent(diff) {
  const container = document.getElementById("diff-content");
  container.innerHTML = "";

  if (diff.chunks.length === 0) {
    container.innerHTML = '<p class="empty">差分内容がありません（バイナリファイルの可能性）。</p>';
    return;
  }

  for (const chunk of diff.chunks) {
    // チャンクヘッダー
    const headerDiv = document.createElement("div");
    headerDiv.className = "diff-chunk-header";
    headerDiv.textContent = chunk.header;
    container.appendChild(headerDiv);

    // 差分行
    for (const line of chunk.lines) {
      const lineDiv = document.createElement("div");
      let lineClass = "diff-line";
      if (line.origin === "Addition") lineClass += " addition";
      else if (line.origin === "Deletion") lineClass += " deletion";
      else lineClass += " context";
      lineDiv.className = lineClass;

      const oldNo = document.createElement("span");
      oldNo.className = "diff-lineno";
      oldNo.textContent = line.old_lineno != null ? line.old_lineno : "";

      const newNo = document.createElement("span");
      newNo.className = "diff-lineno";
      newNo.textContent = line.new_lineno != null ? line.new_lineno : "";

      const prefix = line.origin === "Addition" ? "+" : line.origin === "Deletion" ? "-" : " ";

      const content = document.createElement("span");
      content.className = "diff-line-content";
      content.textContent = prefix + line.content;

      lineDiv.appendChild(oldNo);
      lineDiv.appendChild(newNo);
      lineDiv.appendChild(content);
      container.appendChild(lineDiv);
    }
  }
}

function setupDiff() {
  document.getElementById("diff-load-btn").addEventListener("click", loadDiff);
}

// ── PR一覧 ──────────────────────────────────────────────────────

async function loadPullRequests() {
  const owner = document.getElementById("pr-owner").value.trim();
  const repo = document.getElementById("pr-repo").value.trim();
  const token = document.getElementById("pr-token").value.trim();
  const container = document.getElementById("pr-list");
  const msg = document.getElementById("pr-message");
  const btn = document.getElementById("pr-load-btn");

  if (!owner || !repo || !token) {
    msg.textContent = "全てのフィールドを入力してください。";
    msg.className = "message error";
    return;
  }

  msg.textContent = "";
  msg.className = "message";
  btn.disabled = true;
  container.innerHTML = '<p class="loading">読み込み中…</p>';

  try {
    const prs = await invoke("list_pull_requests", { owner, repo, token });
    if (prs.length === 0) {
      container.innerHTML = '<p class="empty">オープンなPRがありません。</p>';
      return;
    }
    renderPrList(prs);
  } catch (err) {
    container.innerHTML = `<p class="error">エラー: ${escapeHtml(String(err))}</p>`;
  } finally {
    btn.disabled = false;
  }
}

function renderPrList(prs) {
  const container = document.getElementById("pr-list");
  container.innerHTML = "";

  for (const pr of prs) {
    const div = document.createElement("div");
    div.className = "pr-item";

    const header = document.createElement("div");
    header.className = "pr-item-header";

    const number = document.createElement("span");
    number.className = "pr-number";
    number.textContent = "#" + pr.number;
    header.appendChild(number);

    const title = document.createElement("span");
    title.className = "pr-title";
    title.textContent = pr.title;
    header.appendChild(title);

    const state = document.createElement("span");
    state.className = "pr-state " + pr.state;
    state.textContent = pr.state;
    header.appendChild(state);

    div.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "pr-meta";
    meta.innerHTML =
      `<span>@${escapeHtml(pr.author)}</span>` +
      `<span>${escapeHtml(pr.head_branch)}</span>` +
      `<span class="pr-stat additions">+${pr.additions}</span>` +
      `<span class="pr-stat deletions">-${pr.deletions}</span>` +
      `<span class="pr-stat">${pr.changed_files} files</span>`;
    div.appendChild(meta);

    container.appendChild(div);
  }
}

function setupPr() {
  document.getElementById("pr-load-btn").addEventListener("click", loadPullRequests);
}

// ── ユーティリティ ──────────────────────────────────────────────────

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ── キーボードショートカット ──────────────────────────────────────

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

function getSelectedIndex(items) {
  let currentIndex = -1;
  items.forEach((item, i) => {
    if (item.classList.contains("selected")) currentIndex = i;
  });
  return currentIndex;
}

function getListItems(tab) {
  if (tab === "worktree") {
    return document.querySelectorAll("#worktree-list .wt-item");
  } else if (tab === "branch") {
    return document.querySelectorAll("#branch-list .branch-item");
  } else if (tab === "diff") {
    return document.querySelectorAll("#diff-file-list .diff-file-item");
  } else if (tab === "pr") {
    return document.querySelectorAll("#pr-list .pr-item");
  }
  return null;
}

function navigateList(direction) {
  const tab = getActiveTab();
  const items = getListItems(tab);

  if (!items || items.length === 0) return;

  const currentIndex = getSelectedIndex(items);

  let nextIndex;
  if (direction === "down") {
    nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
  } else {
    nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
  }

  items.forEach((item) => item.classList.remove("selected"));
  items[nextIndex].classList.add("selected");
  items[nextIndex].scrollIntoView({ block: "nearest" });

  // Diffタブではファイル選択も連動
  if (tab === "diff") {
    selectDiffFile(nextIndex);
  }
}

function getSelectedBranchName() {
  const items = document.querySelectorAll("#branch-list .branch-item");
  const index = getSelectedIndex(items);
  if (index < 0) return null;
  const nameEl = items[index].querySelector(".branch-name");
  if (!nameEl) return null;
  // HEADブランチは "* name" 形式なので先頭の "* " を除去
  return nameEl.textContent.replace(/^\*\s*/, "");
}

async function refreshCurrentView() {
  const tab = getActiveTab();
  if (tab === "worktree") {
    await loadWorktrees();
  } else if (tab === "branch") {
    await loadBranches();
  } else if (tab === "diff") {
    await loadDiff();
  } else if (tab === "pr") {
    await loadPullRequests();
  }
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // テキスト入力中はショートカットを無効にする
    if (isInputFocused()) return;
    // ダイアログ表示中も無効
    const dialog = document.getElementById("confirm-dialog");
    if (dialog && !dialog.hidden) return;

    switch (e.key) {
      case "Tab":
        e.preventDefault();
        {
          const current = getActiveTab();
          const idx = TAB_ORDER.indexOf(current);
          const next = TAB_ORDER[(idx + 1) % TAB_ORDER.length];
          switchTab(next);
        }
        break;
      case "w":
        switchTab("worktree");
        break;
      case "b":
        switchTab("branch");
        break;
      case "d":
        switchTab("diff");
        break;
      case "p":
        switchTab("pr");
        break;
      case "j":
      case "ArrowDown":
        e.preventDefault();
        navigateList("down");
        break;
      case "k":
      case "ArrowUp":
        e.preventDefault();
        navigateList("up");
        break;
      case "r":
        e.preventDefault();
        refreshCurrentView();
        break;
      case "c":
        // Branchタブでは新規ブランチ作成フォームにフォーカス
        if (getActiveTab() === "branch") {
          e.preventDefault();
          document.getElementById("branch-name").focus();
        }
        break;
      case "x":
        // Branchタブでは選択中のブランチを削除
        if (getActiveTab() === "branch") {
          e.preventDefault();
          const deleteName = getSelectedBranchName();
          if (deleteName) handleDeleteBranch(deleteName);
        }
        break;
      case "Enter":
        // Branchタブでは選択中のブランチに切り替え
        if (getActiveTab() === "branch") {
          e.preventDefault();
          const switchName = getSelectedBranchName();
          if (switchName) handleSwitchBranch(switchName);
        }
        break;
    }
  });
}

// ── 初期化 ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupKeyboardShortcuts();
  setupWorktreeForm();
  setupBranchForm();
  setupDiff();
  setupPr();
  loadWorktrees();
  loadBranches();
});
