import {
  BytiumResourceDynamicModuleInterface,
  ConstructorType,
  FactoryProviderInterface,
  ProviderType,
  ValueProviderInterface,
} from "@bytium-core/common";
import { ConfigModuleOptionsInterface } from "@config/interfaces/config-module-options.interface";
import { ConfigModuleAsyncOptions } from "@config/interfaces/config-module-async-options.interface";
import { ConfigService } from "@config/services/config.service";
import { NamespacedConfigFactory } from "@config/interfaces/namespaced-config-factory.interface";

/**
 * Dynamic module that exposes a {@link ConfigService} for reading resource configuration.
 */
export class ConfigModule {
  /** Registers the config module with static options. */
  static forRoot(options: ConfigModuleOptionsInterface = {}): BytiumResourceDynamicModuleInterface {
    const optionsProvider: ValueProviderInterface<ConfigModuleOptionsInterface> = {
      provide: "CONFIG_OPTIONS",
      useValue: options,
    };
    const providers: ProviderType[] = [optionsProvider, ConfigService];

    return {
      module: ConfigModule as ConstructorType,
      name: "configRootModule",
      global: options.global,
      providers,
      exports: [ConfigService],
    };
  }

  /** Registers the config module with options produced by a factory, so they can depend on other providers. */
  static forRootAsync(options: ConfigModuleAsyncOptions): BytiumResourceDynamicModuleInterface {
    const optionsProvider: FactoryProviderInterface<ConfigModuleOptionsInterface> = {
      provide: "CONFIG_OPTIONS",
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };
    const providers: ProviderType[] = [optionsProvider, ConfigService];

    return {
      module: ConfigModule as ConstructorType,
      name: "configRootModule",
      global: options.global,
      providers,
      exports: [ConfigService],
    };
  }

  /**
   * Registers a namespaced config slice for injection via `@Inject(factory.KEY)`. The value comes
   * from {@link ConfigService}, so it reflects the processing {@link forRoot} applied - which means
   * `forRoot` must be in scope (typically registered `global`).
   */
  static forFeature(factory: NamespacedConfigFactory): BytiumResourceDynamicModuleInterface {
    const featureProvider: FactoryProviderInterface<Record<string, any>> = {
      provide: factory.KEY,
      useFactory: (configService: ConfigService) =>
        configService.get<Record<string, any>>(factory.namespace) ?? factory()[factory.namespace],
      inject: [ConfigService],
    };

    return {
      module: ConfigModule as ConstructorType,
      name: "configFeatureModule",
      providers: [featureProvider],
      exports: [factory.KEY],
    };
  }
}
