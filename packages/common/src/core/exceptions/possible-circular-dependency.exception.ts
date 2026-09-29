/**
 * Thrown when a circular dependency is detected between providers during resolution.
 */
export class PossibleCircularDependencyException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "PossibleCircularDependencyException";
  }
}
