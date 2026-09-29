import { ConstructorType } from "@bytium-core/common";
import { OverrideByFactoryOptions } from "@testing/interfaces/override-by-factory-options.interface";
import { ProviderToken } from "@testing/types/provider-token.type";
import { OverrideValue } from "@testing/types/override-value.type";
import type { TestingModuleBuilder } from "@testing/builders/testing-module.builder";

/**
 * Chained builder that supplies the override value for a token.
 */
export class OverrideBuilder {
  constructor(
    private readonly token: ProviderToken,
    private readonly callback: (override: OverrideValue) => TestingModuleBuilder,
  ) {}

  /** Overrides the token with a fixed value. */
  useValue(value: unknown): TestingModuleBuilder {
    return this.callback({ provide: this.token, useValue: value });
  }

  /** Overrides the token with a factory. */
  useFactory(options: OverrideByFactoryOptions): TestingModuleBuilder {
    return this.callback({
      provide: this.token,
      useFactory: options.factory,
      inject: options.inject ?? [],
    });
  }

  /** Overrides the token with a class to instantiate. */
  useClass(classRef: ConstructorType): TestingModuleBuilder {
    return this.callback({ provide: this.token, useClass: classRef });
  }

  /** Overrides the token by aliasing an existing token. */
  useExisting(target: ProviderToken): TestingModuleBuilder {
    return this.callback({ provide: this.token, useExisting: target });
  }
}
