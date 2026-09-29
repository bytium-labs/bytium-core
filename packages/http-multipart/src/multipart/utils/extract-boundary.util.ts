/** Extracts the boundary token from a `multipart/form-data; boundary=...` Content-Type header. */
export function extractBoundary(contentType: string | undefined): string | undefined {
  if (!contentType) return undefined;

  const match = contentType.match(/boundary=("?)([^";]+)\1/i);

  return match ? match[2] : undefined;
}
