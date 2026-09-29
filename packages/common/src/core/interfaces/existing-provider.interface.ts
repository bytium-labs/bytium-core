import { ConstructorType } from "@shared";

/**
 * A provider that aliases an existing token.
 */
export interface ExistingProviderInterface {
  /** Token the provider is registered under. */
  provide: string | symbol | ConstructorType;

  /** Existing token to resolve and reuse. */
  useExisting: string | symbol | ConstructorType;

  /** When `true`, contributes an entry to the token's multi-provider array instead of replacing it. */
  multi?: boolean;
}

export const instanceOfExistingProvider = (value: unknown): value is ExistingProviderInterface => {
  return (
    typeof value === "object" &&
    value !== null &&
    "provide" in value &&
    "useExisting" in value &&
    (typeof value.provide === "string" || typeof value.provide === "symbol" || typeof value.provide === "function") &&
    (typeof value.useExisting === "string" ||
      typeof value.useExisting === "symbol" ||
      typeof value.useExisting === "function")
  );
};
