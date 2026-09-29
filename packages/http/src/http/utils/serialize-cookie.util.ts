import { CookieOptions } from "@http/interfaces/cookie-options.interface";

/** Serializes a cookie and its attributes into a single `Set-Cookie` header value. */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${value}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);

  if (options.domain) parts.push(`Domain=${options.domain}`);

  if (options.path) parts.push(`Path=${options.path}`);

  if (options.httpOnly) parts.push("HttpOnly");

  if (options.secure) parts.push("Secure");

  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join("; ");
}
