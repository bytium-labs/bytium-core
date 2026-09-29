/**
 * Thrown when a cross-resource dependency cannot be resolved because the target resource is not started or does not expose the requested export.
 */
export class ExternalDependencyUnavailableException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "ExternalDependencyUnavailableException";
  }
}
