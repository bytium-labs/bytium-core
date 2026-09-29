/**
 * Thrown when a node in the dependency graph has an unrecognized dependency type.
 */
export class UnknownDependencyTypeException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "UnknownDependencyTypeException";
  }
}
