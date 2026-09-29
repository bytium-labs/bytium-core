/**
 * Attributes for a cookie set with {@link HttpResponse.cookie}.
 */
export interface CookieOptions {
  /** Lifetime in seconds, sent as `Max-Age`. */
  maxAge?: number;

  /** `Domain` the cookie is scoped to. */
  domain?: string;

  /** `Path` the cookie is scoped to. */
  path?: string;

  /** When `true`, sends the `HttpOnly` attribute so scripts cannot read the cookie. */
  httpOnly?: boolean;

  /** When `true`, sends the `Secure` attribute so the cookie is only sent over HTTPS. */
  secure?: boolean;

  /** `SameSite` policy controlling when the cookie is sent on cross-site requests. */
  sameSite?: "Strict" | "Lax" | "None";
}
