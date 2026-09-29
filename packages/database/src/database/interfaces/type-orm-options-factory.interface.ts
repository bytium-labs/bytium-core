import { TypeOrmModuleOptions } from "@database/types/type-orm-module-options.type";

/**
 * Implemented by classes used with `TypeOrmModule.forRootAsync({ useClass | useExisting })`.
 */
export interface TypeOrmOptionsFactory {
  createTypeOrmOptions(connectionName?: string): Promise<TypeOrmModuleOptions> | TypeOrmModuleOptions;
}
