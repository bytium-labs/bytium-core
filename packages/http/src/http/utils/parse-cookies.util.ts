/** Parses a `Cookie` header (`a=1; b=2`) into a map of cookie names to values. */
export function parseCookies(header?: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!header) return cookies;

  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");

    if (separator < 0) continue;

    const name = pair.slice(0, separator).trim();

    if (name) cookies[name] = pair.slice(separator + 1).trim();
  }

  return cookies;
}
