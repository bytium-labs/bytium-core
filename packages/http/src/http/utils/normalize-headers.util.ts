/** Lowercases every header key so lookups are case-insensitive, matching Node's `req.headers` convention. */
export function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) normalized[key.toLowerCase()] = value;

  return normalized;
}
