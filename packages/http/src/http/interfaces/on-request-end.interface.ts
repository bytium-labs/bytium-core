/**
 * Lifecycle hook for request-scoped providers, called once the response has finished.
 */
export interface OnRequestEnd {
  onRequestEnd(): void | Promise<void>;
}

export function instanceOfOnRequestEnd(value: unknown): value is OnRequestEnd {
  return typeof (value as OnRequestEnd)?.onRequestEnd === "function";
}
