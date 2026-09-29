import { FactoryInjectToken } from "@core/types/factory-inject-token.type";

/**
 * Marks a factory inject token as optional, so an unresolved dependency is injected as `undefined`.
 */
export interface OptionalFactoryDependency {
  /** Token to inject. */
  token: FactoryInjectToken;

  /** Always `true`; marks the dependency optional. */
  optional: true;
}
