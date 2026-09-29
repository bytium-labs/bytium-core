import { BytiumMetadataEnum } from "@shared";

/**
 * Marks a resource module as global: its exported providers become injectable everywhere without importing the module.
 *
 * @example
 * ```ts
 * @Global()
 * @BytiumResourceModule({ providers: [ConfigService], exports: [ConfigService] })
 * class ConfigModule {}
 * ```
 */
export function Global() {
  return function <T extends { new (...args: any[]): object }>(constructor: T) {
    Reflect.defineMetadata(BytiumMetadataEnum.DEPENDENCY_GLOBAL, true, constructor);

    return constructor;
  };
}
