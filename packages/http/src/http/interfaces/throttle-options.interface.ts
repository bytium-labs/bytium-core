/**
 * Rate limit applied to a handler by {@link Throttle}.
 */
export interface ThrottleOptions {
  /** Maximum number of requests allowed per IP within the window. */
  limit: number;

  /** Length of the window in milliseconds. */
  ttlMs: number;
}
