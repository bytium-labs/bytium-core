/**
 * Thrown when an `@Inject()` token is invalid or missing (e.g. `undefined`, often caused by a circular import).
 */
export class InvalidInjectException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "InvalidInjectException";
  }
}
