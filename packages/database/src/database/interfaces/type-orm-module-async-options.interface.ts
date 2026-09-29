import { TypeOrmModuleOptions } from "@database/types/type-orm-module-options.type";
import { TypeOrmOptionsFactory } from "@database/interfaces/type-orm-options-factory.interface";

/**
 * Async configuration for a TypeORM data source, produced by a factory, class, or existing provider.
 */
export interface TypeOrmModuleAsyncOptions {
  /** Data source name (identifies the connection when several are registered). */
  name?: string;

  /** Modules whose exports must be visible to the async factory / class / existing provider. */
  imports?: any[];

  /** Factory that produces the data-source options; may be async and depend on injected providers. */
  useFactory?: (...args: any[]) => TypeOrmModuleOptions | Promise<TypeOrmModuleOptions>;

  /** Class implementing `TypeOrmOptionsFactory` that produces the options. */
  useClass?: new (...args: any[]) => TypeOrmOptionsFactory;

  /** Existing provider implementing `TypeOrmOptionsFactory` to reuse. */
  useExisting?: new (...args: any[]) => TypeOrmOptionsFactory;

  /** Providers injected into `useFactory`. */
  inject?: any[];

  /** When `true`, the data source is available to every module without explicit imports. */
  global?: boolean;
}
