/**
 * @tauri-apps/plugin-dialog のStorybook用シム。
 */
export async function open(): Promise<string | null> {
  return "/Users/dev/project";
}

export async function save(): Promise<string | null> {
  return "/Users/dev/project/output.txt";
}

export async function message(): Promise<void> {
  return;
}

export async function ask(): Promise<boolean> {
  return true;
}

export async function confirm(): Promise<boolean> {
  return true;
}
