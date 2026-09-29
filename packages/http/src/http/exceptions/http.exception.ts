/**
 * Base class for exceptions that carry an HTTP status.
 */
export class HttpException extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);

    this.name = "HttpException";
  }
}
