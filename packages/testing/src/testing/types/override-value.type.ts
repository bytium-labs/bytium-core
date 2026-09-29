import { ConstructorType, FactoryInjectToken, OptionalFactoryDependency } from "@bytium-core/common";
import { ProviderToken } from "@testing/types/provider-token.type";

/**
 * The resolved override applied to a provider token in a testing module.
 */
export type OverrideValue =
  | { provide: ProviderToken; useValue: unknown }
  | {
      provide: ProviderToken;
      useFactory: (...args: unknown[]) => unknown;
      inject: Array<FactoryInjectToken | OptionalFactoryDependency>;
    }
  | { provide: ProviderToken; useClass: ConstructorType }
  | { provide: ProviderToken; useExisting: ProviderToken };
