/**
 * Thrown when `resolve()` is called on a manager while a previous call is still in flight.
 */
export class ConcurrentResolveException extends Error {
  constructor(message: string) {
    super(message);

    this.name = "ConcurrentResolveException";
  }
}
