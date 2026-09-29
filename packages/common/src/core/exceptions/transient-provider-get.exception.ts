/**
 * Thrown when a transient-scoped provider is retrieved via `ModuleRef.get()`, which only supports singletons; use `ModuleRef.resolve()` instead.
 */
export class TransientProviderGetException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "TransientProviderGetException";
  }
}
