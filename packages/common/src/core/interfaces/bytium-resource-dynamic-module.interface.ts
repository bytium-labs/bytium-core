import { BytiumResourceModuleMetadataInterface } from "@core/interfaces/bytium-resource-module-metadata.interface";
import { ConstructorType } from "@shared";

/**
 * A module produced at runtime with its providers and imports configured (e.g. by `forRoot`).
 */
export interface BytiumResourceDynamicModuleInterface extends BytiumResourceModuleMetadataInterface {
  /** The module class this dynamic configuration applies to. */
  module: ConstructorType;
}

export const instanceOfBytiumResourceDynamicModule = (
  value: unknown,
): value is BytiumResourceDynamicModuleInterface => {
  return typeof value === "object" && value !== null && "module" in value && typeof value.module === "function";
};
