// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BranchInfoResponse {
    pub name: String,
    pub is_head: bool,
    pub upstream: Option<String>,
}

#[tauri::command]
fn list_branches() -> Result<Vec<BranchInfoResponse>, String> {
    let branches =
        reown::git::branch::list_branches(".").map_err(|e| format!("{e:#}"))?;

    Ok(branches
        .into_iter()
        .map(|b| BranchInfoResponse {
            name: b.name,
            is_head: b.is_head,
            upstream: b.upstream,
        })
        .collect())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_branches])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
