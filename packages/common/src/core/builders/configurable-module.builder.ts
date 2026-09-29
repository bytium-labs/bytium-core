import { BytiumResourceDynamicModuleInterface } from "@core/interfaces/bytium-resource-dynamic-module.interface";
import { BytiumResourceModuleMetadataInterface } from "@core/interfaces/bytium-resource-module-metadata.interface";
import { ConfigurableModuleAsyncOptions } from "@core/interfaces/configurable-module-async-options.interface";
import { BytiumMetadataEnum, ConstructorType } from "@shared";

/**
 * Produces a base module class to extend and an options injection token to `@Inject`, removing the `register`/`registerAsync` boilerplate.
 *
 * @example
 * ```ts
 * const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<MyOptions>().build();
 *
 * @BytiumResourceModule({ name: "myModule", providers: [MyService], exports: [MyService] })
 * export class MyModule extends ConfigurableModuleClass {}
 *
 * // imports: [MyModule.register({ ... })]  - MyService injects @Inject(MODULE_OPTIONS_TOKEN)
 * ```
 */
export class ConfigurableModuleBuilder<TOptions> {
  #isGlobal = false;

  /** Marks the produced module global, so its options (and exports) are visible without explicit imports. */
  setGlobal(isGlobal = true): this {
    this.#isGlobal = isGlobal;

    return this;
  }

  /** Produces the base module class to extend and the options injection token to `@Inject`. */
  build(): {
    ConfigurableModuleClass: ConstructorType & {
      register(options: TOptions): BytiumResourceDynamicModuleInterface;
      registerAsync(options: ConfigurableModuleAsyncOptions<TOptions>): BytiumResourceDynamicModuleInterface;
    };
    MODULE_OPTIONS_TOKEN: symbol;
  } {
    const isGlobal = this.#isGlobal;
    const MODULE_OPTIONS_TOKEN = Symbol("MODULE_OPTIONS");

    class ConfigurableModuleClass {
      private static declared(): BytiumResourceModuleMetadataInterface {
        return (Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONS, this) ??
          {}) as BytiumResourceModuleMetadataInterface;
      }

      static register(options: TOptions): BytiumResourceDynamicModuleInterface {
        const declared = this.declared();

        return {
          module: this as unknown as ConstructorType,
          name: declared.name ?? this.name,
          global: isGlobal || declared.global,
          imports: declared.imports,
          controllers: declared.controllers,
          providers: [...(declared.providers ?? []), { provide: MODULE_OPTIONS_TOKEN, useValue: options }],
          exports: [...(declared.exports ?? []), MODULE_OPTIONS_TOKEN],
        };
      }

      static registerAsync(options: ConfigurableModuleAsyncOptions<TOptions>): BytiumResourceDynamicModuleInterface {
        const declared = this.declared();

        return {
          module: this as unknown as ConstructorType,
          name: declared.name ?? this.name,
          global: isGlobal || declared.global,
          imports: declared.imports,
          controllers: declared.controllers,
          providers: [
            ...(declared.providers ?? []),
            { provide: MODULE_OPTIONS_TOKEN, useFactory: options.useFactory, inject: options.inject ?? [] },
          ],
          exports: [...(declared.exports ?? []), MODULE_OPTIONS_TOKEN],
        };
      }
    }

    return { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN };
  }
}
