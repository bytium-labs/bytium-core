import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumResourceModuleMetadataInterface } from "@core/interfaces/bytium-resource-module-metadata.interface";
import { ExistingProviderInterface } from "@core/interfaces/existing-provider.interface";
import { FactoryProviderInterface } from "@core/interfaces/factory-provider.interface";
import { ValueProviderInterface } from "@core/interfaces/value-provider.interface";
import { BytiumResourceDynamicModuleInterface } from "@core/interfaces/bytium-resource-dynamic-module.interface";
import { ForwardRefDependencyInterface } from "@core/interfaces/forward-ref-dependency.interface";
import { BytiumMetadataEnum, ConstructorType } from "@shared";
import { ClassProviderInterface } from "@core/interfaces/class-provider.interface";

/**
 * Options for `@BytiumResourceModule()`.
 */
export class BytiumResourceModuleOptions implements BytiumResourceModuleMetadataInterface {
  /** Name of the module that will be used to access it from external resources. */
  name: string;

  /**
   * Whether the module is global (available across all modules without explicit imports).
   *
   * @default false
   */
  global?: boolean;

  /** Controllers declared by this module. */
  controllers?: (ConstructorType | ForwardRefDependencyInterface)[] = [];

  /** Modules this module imports - module classes, dynamic modules, or external resource links (e.g. `resourceName:moduleName`). */
  imports?: (ConstructorType | ForwardRefDependencyInterface | BytiumResourceDynamicModuleInterface | string)[] = [];

  /** Providers this module registers. */
  providers?: (
    | ConstructorType
    | ForwardRefDependencyInterface
    | FactoryProviderInterface
    | ValueProviderInterface
    | ClassProviderInterface
    | ExistingProviderInterface
    | string
  )[] = [];

  /** Providers this module exposes to importing modules. */
  exports?: (ConstructorType | ForwardRefDependencyInterface | string | symbol)[] = [];

  /** Providers exposed to other resources. */
  crossResourceExports?: (ConstructorType | ForwardRefDependencyInterface | string | symbol)[] = [];
}

/**
 * Groups a resource's providers and controllers into a module.
 *
 * @param options \@BytiumResourceModule() decorator options.
 */
export function BytiumResourceModule(options: BytiumResourceModuleOptions): ClassDecorator;
export function BytiumResourceModule(options: BytiumResourceModuleOptions) {
  const moduleOptions = new BytiumResourceModuleOptions();

  Object.assign(moduleOptions, options);

  return function <T extends { new (...args: any[]): object }>(constructor: T) {
    Reflect.defineMetadata(BytiumMetadataEnum.DEPENDENCY_TYPE, BytiumDependencyTypeEnum.MODULE, constructor);
    Reflect.defineMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONS, moduleOptions, constructor);

    if (options.global) {
      Reflect.defineMetadata(BytiumMetadataEnum.DEPENDENCY_GLOBAL, true, constructor);
    }
  };
}
