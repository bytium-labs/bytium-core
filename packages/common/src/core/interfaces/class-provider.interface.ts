import { ConstructorType } from "@shared";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";

/**
 * A provider that instantiates a class for a token.
 */
export interface ClassProviderInterface {
  /** Token the provider is registered under. */
  provide: string | symbol | ConstructorType;

  /** Class to instantiate. */
  useClass: ConstructorType;

  /** Lifecycle scope of the instance. */
  scope?: BytiumProviderScopeEnum;

  /** When `true`, contributes an entry to the token's multi-provider array instead of replacing it. */
  multi?: boolean;
}

export const instanceOfClassProvider = (value: unknown): value is ClassProviderInterface => {
  return (
    typeof value === "object" &&
    value !== null &&
    "provide" in value &&
    "useClass" in value &&
    (typeof value.provide === "string" || typeof value.provide === "symbol" || typeof value.provide === "function") &&
    typeof value.useClass === "function"
  );
};
