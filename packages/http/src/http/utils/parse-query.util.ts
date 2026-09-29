/**
 * Parses a raw query string into a flat record. A key repeated across the query (`tag=a&tag=b`)
 * collects into an array; a key seen once stays a string.
 */
export function parseQuery(rawQuery: string): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};

  if (!rawQuery) return query;

  for (const pair of rawQuery.split("&")) {
    if (!pair) continue;

    const [key, value = ""] = pair.split("=");
    const decodedKey = decodeURIComponent(key);
    const decodedValue = decodeURIComponent(value);
    const existing = query[decodedKey];

    if (existing === undefined) {
      query[decodedKey] = decodedValue;
    } else {
      query[decodedKey] = Array.isArray(existing) ? [...existing, decodedValue] : [existing, decodedValue];
    }
  }

  return query;
}
