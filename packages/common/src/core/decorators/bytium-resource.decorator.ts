import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumResourceDynamicModuleInterface } from "@core/interfaces/bytium-resource-dynamic-module.interface";
import { ExternalResourceImportInterface } from "@core/interfaces/external-resource-import.interface";
import { BytiumMetadataEnum, ConstructorType } from "@shared";

/**
 * Options for `@BytiumResource()`.
 */
export class BytiumResourceOptions {
  /** External resources to import - a name, or a name with the semver range it works with. */
  imports?: (string | ExternalResourceImportInterface)[] = [];

  /** Modules this resource registers. */
  modules: (ConstructorType | BytiumResourceDynamicModuleInterface)[] = [];

  /**
   * How long (in milliseconds) to wait for an imported external resource to become available before giving up.
   *
   * @default 30000
   */
  externalResourceTimeoutMs?: number = 30000;
}

/**
 * Marks the root class of a Bytium resource - the entry point passed to `bootstrap()`.
 *
 * @param options \@BytiumResource() decorator options.
 */
export function BytiumResource(options: BytiumResourceOptions) {
  const resourceOptions = new BytiumResourceOptions();

  Object.assign(resourceOptions, options);

  return function <T extends { new (...args: any[]): object }>(constructor: T) {
    Reflect.defineMetadata(BytiumMetadataEnum.DEPENDENCY_TYPE, BytiumDependencyTypeEnum.RESOURCE, constructor);
    Reflect.defineMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONS, resourceOptions, constructor);
  };
}
