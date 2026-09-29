import { DataSource, EntityTarget, ObjectLiteral, Repository } from "typeorm";
import { Injectable, OnModuleDestroyInterface, Logger } from "@bytium-core/common";
import { TypeOrmModuleOptions } from "@database/types/type-orm-module-options.type";
import { DataSourceNotFoundException } from "@database/exceptions/data-source-not-found.exception";

@Injectable()
export class TypeOrmCoreService implements OnModuleDestroyInterface {
  private readonly logger = new Logger("TypeOrmCoreService");
  private dataSources: Map<string, DataSource> = new Map();

  async createConnection(options: TypeOrmModuleOptions, name = "default"): Promise<DataSource> {
    if (this.dataSources.has(name)) {
      return this.getConnection(name);
    }

    const retryAttempts = options.retryAttempts ?? 10;
    const retryDelay = options.retryDelay ?? 3000;
    const finalOptions = { ...options, name };
    const buildDataSource = async (): Promise<DataSource> => {
      const ds = options.dataSourceFactory
        ? await options.dataSourceFactory(finalOptions)
        : new DataSource(finalOptions);

      if (!ds.isInitialized) {
        await ds.initialize();
      }

      return ds;
    };
    let attempt = 0;
    let lastError: unknown;

    while (attempt < retryAttempts) {
      attempt++;

      try {
        const dataSource = await buildDataSource();

        this.dataSources.set(name, dataSource);
        this.logger.log(`DataSource "${name}" initialized`);

        return dataSource;
      } catch (error) {
        lastError = error;

        if (attempt >= retryAttempts) break;

        this.logger.warn(
          `DataSource "${name}" initialization failed (attempt ${attempt}/${retryAttempts}). Retrying in ${retryDelay}ms.`,
        );

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    throw lastError;
  }

  getConnection(name = "default"): DataSource {
    const dataSource = this.dataSources.get(name);

    if (!dataSource) {
      throw new DataSourceNotFoundException(`DataSource "${name}" not found`);
    }

    return dataSource;
  }

  getRepository<Entity extends ObjectLiteral>(
    entity: EntityTarget<Entity>,
    connectionName = "default",
  ): Repository<Entity> {
    return this.getConnection(connectionName).getRepository(entity);
  }

  async closeConnection(name = "default"): Promise<void> {
    const dataSource = this.dataSources.get(name);

    if (dataSource?.isInitialized) {
      await dataSource.destroy();
      this.dataSources.delete(name);
      this.logger.log(`DataSource "${name}" closed`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const [name] of this.dataSources) {
      await this.closeConnection(name);
    }
  }
}
