import { ConstructorType } from "@shared";

/**
 * A provider that supplies a ready-made value for a token.
 */
export interface ValueProviderInterface<T = any> {
  /** Token the provider is registered under. */
  provide: string | symbol | ConstructorType;

  /** Value to supply. */
  useValue: T;

  /** When `true`, contributes an entry to the token's multi-provider array instead of replacing it. */
  multi?: boolean;
}

export const instanceOfValueProvider = (value: unknown): value is ValueProviderInterface => {
  return (
    typeof value === "object" &&
    value !== null &&
    "provide" in value &&
    "useValue" in value &&
    (typeof value.provide === "string" || typeof value.provide === "symbol" || typeof value.provide === "function")
  );
};
