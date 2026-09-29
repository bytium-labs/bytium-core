import { FactoryInjectToken, OptionalFactoryDependency } from "@bytium-core/common";

/**
 * Factory override for a provider in a testing module.
 */
export interface OverrideByFactoryOptions {
  /** Produces the override value. */
  factory: (...args: any[]) => any;

  /** Providers passed to `factory`, in declaration order. */
  inject?: Array<FactoryInjectToken | OptionalFactoryDependency>;
}
