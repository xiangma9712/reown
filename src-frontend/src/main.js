// Tauri APIが利用可能な場合、ブランチ一覧を取得して表示する
async function loadBranches() {
  const container = document.getElementById("branches");
  if (!window.__TAURI__) {
    container.innerHTML = "<p>Tauri API not available (running in browser)</p>";
    return;
  }

  try {
    const { invoke } = window.__TAURI__.core;
    const branches = await invoke("list_branches");
    if (branches.length === 0) {
      container.innerHTML = "<p>No branches found.</p>";
      return;
    }
    const ul = document.createElement("ul");
    for (const b of branches) {
      const li = document.createElement("li");
      li.textContent = b.is_head ? `* ${b.name}` : `  ${b.name}`;
      if (b.is_head) li.classList.add("head");
      ul.appendChild(li);
    }
    container.appendChild(ul);
  } catch (err) {
    container.innerHTML = `<p>Error: ${err}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadBranches);
