export function stringifySource(rawSource: unknown): string {
  return rawSource === null || rawSource === undefined ? "" : String(rawSource);
}
