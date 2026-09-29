import { ForwardRefDependencyInterface } from "@core/interfaces/forward-ref-dependency.interface";
import { BytiumResourceDynamicModuleInterface } from "@core/interfaces/bytium-resource-dynamic-module.interface";
import { ExistingProviderInterface } from "@core/interfaces/existing-provider.interface";
import { FactoryProviderInterface } from "@core/interfaces/factory-provider.interface";
import { ValueProviderInterface } from "@core/interfaces/value-provider.interface";
import { ConstructorType } from "@shared";
import { ClassProviderInterface } from "@core/interfaces/class-provider.interface";

/**
 * Options for `@BytiumResourceModule()`.
 */
export interface BytiumResourceModuleMetadataInterface {
  /** Name of the module that will be used to create controller paths and to access it from external resources. */
  name: string;

  /**
   * Whether the module is global (available across all modules in this resource without explicit imports).
   *
   * @default false
   */
  global?: boolean;

  /** Controllers declared by this module. */
  controllers?: (ConstructorType | ForwardRefDependencyInterface)[];

  /** Modules this module imports - module classes, dynamic modules, or external resource links (e.g. `resourceName:moduleName`). */
  imports?: (ConstructorType | ForwardRefDependencyInterface | BytiumResourceDynamicModuleInterface | string)[];

  /** Providers this module registers. */
  providers?: (
    | ConstructorType
    | ForwardRefDependencyInterface
    | FactoryProviderInterface
    | ValueProviderInterface
    | ClassProviderInterface
    | ExistingProviderInterface
    | string
  )[];

  /** Providers this module exposes to importing modules. */
  exports?: (ConstructorType | ForwardRefDependencyInterface | string | symbol)[];

  /** Providers exposed to other resources. */
  crossResourceExports?: (ConstructorType | ForwardRefDependencyInterface | string | symbol)[];
}
