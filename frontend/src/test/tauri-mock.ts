import { vi } from "vitest";
import type { Commands } from "../invoke";

type MockInvoke = <C extends keyof Commands>(
  command: C,
  args?: Commands[C]["args"]
) => Promise<Commands[C]["ret"]>;

/**
 * Tauri IPC の invoke をモックするヘルパー。
 *
 * コマンド名ごとにレスポンスを定義できる。
 *
 * @example
 * ```ts
 * mockInvoke({
 *   list_branches: [{ name: "main", is_head: true, upstream: null }],
 * });
 * ```
 */
export function mockInvoke(
  handlers: Partial<{ [C in keyof Commands]: Commands[C]["ret"] }>
) {
  const mock = vi.fn<MockInvoke>().mockImplementation((command) => {
    if (command in handlers) {
      return Promise.resolve(
        handlers[command as keyof typeof handlers] as ReturnType<
          typeof Promise.resolve
        > extends never
          ? never
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any
      );
    }
    return Promise.reject(new Error(`Unhandled invoke command: ${command}`));
  });

  vi.mock("@tauri-apps/api/core", () => ({
    invoke: mock,
  }));

  return mock;
}
