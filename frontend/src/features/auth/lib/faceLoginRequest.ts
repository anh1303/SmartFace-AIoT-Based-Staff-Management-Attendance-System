export const FACE_LOGIN_TIMEOUTS = {
  CONFIG_MS: 4_000,
  START_MS: 4_000,
  FRAME_MS: 4_000,
  STATUS_MS: 2_000,
  CANCEL_MS: 2_000,
  COMPLETE_POST_MS: 4_000,
  COMPLETE_BUDGET_MS: 10_000,
  LOGOUT_MS: 4_000,
  LOGOUT_SETTLE_MS: 1_000,
} as const;

/**
 * Combines an optional parent AbortSignal with a bounded timeout (clamped by an optional remaining budget),
 * ensuring all timers and event listeners are cleaned up in `finally`.
 */
export async function withBoundedSignal<T>(
  timeoutMs: number,
  parentSignal: AbortSignal | undefined,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (parentSignal?.aborted) {
    throw parentSignal.reason instanceof Error
      ? parentSignal.reason
      : new DOMException('The operation was aborted.', 'AbortError');
  }
  const boundedMs = Math.max(1, Math.floor(timeoutMs));
  const controller = new AbortController();
  const onParentAbort = () => {
    controller.abort(
      parentSignal?.reason instanceof Error
        ? parentSignal.reason
        : new DOMException('The operation was aborted.', 'AbortError'),
    );
  };
  parentSignal?.addEventListener('abort', onParentAbort, { once: true });
  const timer = setTimeout(() => {
    controller.abort(new DOMException('The operation timed out.', 'TimeoutError'));
  }, boundedMs);

  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}
