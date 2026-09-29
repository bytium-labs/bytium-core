/**
 * Thrown when the same provider token is registered more than once within a module.
 */
export class DuplicateProviderException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "DuplicateProviderException";
  }
}
