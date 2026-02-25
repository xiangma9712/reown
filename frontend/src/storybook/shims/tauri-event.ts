/**
 * @tauri-apps/api/event のStorybook用シム。
 * Vite alias で実際のTauriモジュールの代わりに読み込まれる。
 */
import { mockListen } from "../tauri-event-mock";

export const listen = mockListen;

export type UnlistenFn = () => void;
