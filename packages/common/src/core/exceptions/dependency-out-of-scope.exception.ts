/**
 * Thrown when a provider depends on a token that exists in the graph but is not visible from its module's scope (not provided locally, imported, nor global).
 */
export class DependencyOutOfScopeException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "DependencyOutOfScopeException";
  }
}
