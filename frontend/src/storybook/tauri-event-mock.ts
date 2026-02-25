/**
 * Storybook用 @tauri-apps/api/event モック。
 *
 * ChangeSummaryList等で使用される listen / emit をモックする。
 */

type EventCallback<T> = (event: { payload: T }) => void;
type UnlistenFn = () => void;

const listeners = new Map<string, Set<EventCallback<unknown>>>();

/**
 * イベントリスナーを登録する（Tauriの listen と同等）。
 */
export async function mockListen<T>(
  event: string,
  handler: EventCallback<T>
): Promise<UnlistenFn> {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  const handlerSet = listeners.get(event)!;
  handlerSet.add(handler as EventCallback<unknown>);

  return () => {
    handlerSet.delete(handler as EventCallback<unknown>);
    if (handlerSet.size === 0) {
      listeners.delete(event);
    }
  };
}

/**
 * モックイベントを発火する（ストーリー内でストリーミング等をシミュレート）。
 */
export function emitMockEvent<T>(event: string, payload: T): void {
  const handlerSet = listeners.get(event);
  if (handlerSet) {
    for (const handler of handlerSet) {
      handler({ payload });
    }
  }
}

/**
 * 全リスナーをクリアする。
 */
export function clearMockListeners(): void {
  listeners.clear();
}
