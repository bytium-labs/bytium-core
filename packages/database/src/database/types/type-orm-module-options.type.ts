import { DataSource, DataSourceOptions } from "typeorm";

/**
 * Options for a TypeORM data source (TypeORM's `DataSourceOptions` plus Bytium initialization controls).
 */
export type TypeOrmModuleOptions = DataSourceOptions & {
  name?: string;

  /** Custom factory for the `DataSource`, replacing the default initialization. */
  dataSourceFactory?: (options: DataSourceOptions) => Promise<DataSource> | DataSource;

  /**
   * Number of attempts to initialize the connection.
   *
   * @default 10
   */
  retryAttempts?: number;

  /**
   * Delay between retries in milliseconds.
   *
   * @default 3000
   */
  retryDelay?: number;

  /** When `true`, entities registered through `forFeature(...)` are loaded alongside `entities`. */
  autoLoadEntities?: boolean;

  /** When `true`, the data source is available to every module without explicit imports. */
  global?: boolean;
};
