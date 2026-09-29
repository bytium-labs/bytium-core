/**
 * General-purpose exception for resource code, pairing a human-readable message with an optional machine-readable code
 * and optional per-field errors.
 *
 * Its message, code and errors are client-facing: they survive serialization to the caller even in production, so never
 * put sensitive data in them. Any other error type is sanitized to a generic 500 before leaving the server.
 */
export class BytiumException extends Error {
  constructor(
    message: string,
    public readonly code?: string | number,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);

    this.name = "BytiumException";
  }
}
