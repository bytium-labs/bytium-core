/**
 * Thrown when a contextual-scoped provider is injected into an eager (singleton) provider instead of being resolved per context by its driver.
 */
export class ContextualProviderInjectionException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "ContextualProviderInjectionException";
  }
}
