/**
 * @tauri-apps/api/core のStorybook用シム。
 * Vite alias で実際のTauriモジュールの代わりに読み込まれる。
 */
import { mockTauriInvoke } from "../tauri-invoke-mock";

export const invoke = mockTauriInvoke;
