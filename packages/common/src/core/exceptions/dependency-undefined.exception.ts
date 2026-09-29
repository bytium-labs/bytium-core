/**
 * Thrown when a requested dependency token cannot be found in the dependency graph.
 */
export class DependencyUndefinedException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "DependencyUndefinedException";
  }
}
