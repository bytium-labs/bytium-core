/**
 * Normalizes a route segment to a leading-slash, no-trailing-slash form so controller prefixes and
 * method paths concatenate predictably. `""` / `"/"` become `""`; `"players/"` becomes `"/players"`.
 */
export function normalizePath(segment: string): string {
  const trimmed = segment.trim().replace(/^\/+|\/+$/g, "");

  return trimmed.length === 0 ? "" : `/${trimmed}`;
}
