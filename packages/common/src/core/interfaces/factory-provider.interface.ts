import { ConstructorType } from "@shared";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { FactoryInjectToken } from "@core/types/factory-inject-token.type";
import { OptionalFactoryDependency } from "@core/interfaces/optional-factory-dependency.interface";

/**
 * A provider whose value is produced by a factory function.
 */
export interface FactoryProviderInterface<T = any> {
  /** Token the provider is registered under. */
  provide: string | symbol | ConstructorType;

  /** Factory that produces the value; may be async. */
  useFactory: (...args: any[]) => Promise<T> | T;

  /** Tokens resolved and passed as the factory's arguments. */
  inject?: Array<FactoryInjectToken | OptionalFactoryDependency>;

  /** Lifecycle scope of the produced value. */
  scope?: BytiumProviderScopeEnum;

  /** When `true`, contributes an entry to the token's multi-provider array instead of replacing it. */
  multi?: boolean;
}

export const instanceOfFactoryProvider = (value: unknown): value is FactoryProviderInterface => {
  return (
    typeof value === "object" &&
    value !== null &&
    "provide" in value &&
    "useFactory" in value &&
    (typeof value.provide === "string" || typeof value.provide === "symbol" || typeof value.provide === "function") &&
    typeof value.useFactory === "function"
  );
};
