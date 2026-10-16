// prefix match: a mask on a subtree covers everything nested under it
export function maskCoversPath(mask: string, segments: readonly (string | number)[]): boolean {
  const maskSegments = mask.split(".");

  if (maskSegments.length > segments.length) {
    return false;
  }

  return maskSegments.every((maskSegment, index) => maskSegment === "*" || maskSegment === String(segments[index]));
}

export function maskValueAtPaths(value: unknown, paths: readonly string[]): unknown {
  for (const path of paths) {
    maskPathSegments(value, path.split("."), 0);
  }

  return value;
}

function maskPathSegments(cursor: unknown, segments: readonly string[], index: number): void {
  if (cursor === null || typeof cursor !== "object") {
    return;
  }

  const segment = segments[index];
  const keys = segment === "*" ? Object.keys(cursor) : [segment];
  const isLeaf = index === segments.length - 1;

  for (const key of keys) {
    if (!Reflect.has(cursor, key)) {
      continue;
    }

    if (isLeaf) {
      Reflect.set(cursor, key, "[REDACTED]");

      continue;
    }

    maskPathSegments(Reflect.get(cursor, key), segments, index + 1);
  }
}
