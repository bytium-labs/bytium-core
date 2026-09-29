export function toSegments(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

/**
 * Matches request path segments against a route pattern. Returns the extracted path parameters when they
 * match, or `null` when they don't. A segment starting with `:` binds that position as a parameter; a
 * trailing segment starting with `*` (e.g. `*path`) binds the rest of the path - joined by `/` - as a
 * single parameter and may capture zero segments.
 */
export function matchPath(patternSegments: string[], pathSegments: string[]): Record<string, string> | null {
  const lastPattern = patternSegments[patternSegments.length - 1];
  const hasWildcard = lastPattern !== undefined && lastPattern.startsWith("*");
  const fixedCount = hasWildcard ? patternSegments.length - 1 : patternSegments.length;

  if (hasWildcard ? pathSegments.length < fixedCount : pathSegments.length !== fixedCount) return null;

  const params: Record<string, string> = {};

  for (let index = 0; index < fixedCount; index++) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];

    if (patternSegment.startsWith(":")) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);

      continue;
    }

    if (patternSegment !== pathSegment) return null;
  }

  if (hasWildcard) {
    params[lastPattern.slice(1)] = pathSegments.slice(fixedCount).map(decodeURIComponent).join("/");
  }

  return params;
}

function segmentKind(segment: string): number {
  if (segment.startsWith("*")) return 2;

  if (segment.startsWith(":")) return 1;

  return 0;
}

/**
 * Orders route patterns most-specific-first so the router tries the tightest match before falling back:
 * static segments beat `:param`, which beats `*wildcard`, compared left to right. Use as an `Array.sort`
 * comparator over route segment lists.
 */
export function compareRouteSpecificity(a: string[], b: string[]): number {
  const length = Math.min(a.length, b.length);

  for (let index = 0; index < length; index++) {
    const kindDifference = segmentKind(a[index]) - segmentKind(b[index]);

    if (kindDifference !== 0) return kindDifference;
  }

  return b.length - a.length;
}
