import {
  BytiumResourceDynamicModuleInterface,
  ConstructorType,
  FactoryProviderInterface,
  ProviderType,
  ValueProviderInterface,
} from "@bytium-core/common";
import { I18nModuleOptionsInterface } from "@i18n/interfaces/i18n-module-options.interface";
import { I18nModuleAsyncOptions } from "@i18n/interfaces/i18n-module-async-options.interface";
import { I18nService } from "@i18n/services/i18n.service";

/**
 * Dynamic module that exposes an {@link I18nService} for translating configurable messages.
 */
export class I18nModule {
  /** Registers the i18n module with static options. */
  static forRoot(options: I18nModuleOptionsInterface): BytiumResourceDynamicModuleInterface {
    const optionsProvider: ValueProviderInterface<I18nModuleOptionsInterface> = {
      provide: "I18N_OPTIONS",
      useValue: options,
    };
    const providers: ProviderType[] = [optionsProvider, I18nService];

    return {
      module: I18nModule as ConstructorType,
      name: "i18nRootModule",
      global: options.global,
      providers,
      exports: [I18nService],
    };
  }

  /** Registers the i18n module with options produced by a factory, so they can depend on other providers. */
  static forRootAsync(options: I18nModuleAsyncOptions): BytiumResourceDynamicModuleInterface {
    const optionsProvider: FactoryProviderInterface<I18nModuleOptionsInterface> = {
      provide: "I18N_OPTIONS",
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };
    const providers: ProviderType[] = [optionsProvider, I18nService];

    return {
      module: I18nModule as ConstructorType,
      name: "i18nRootModule",
      global: options.global,
      providers,
      exports: [I18nService],
    };
  }
}
