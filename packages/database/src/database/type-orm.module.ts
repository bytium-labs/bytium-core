import { DataSource, EntityManager, EntityTarget, Repository } from "typeorm";
import {
  ConstructorType,
  BytiumResourceDynamicModuleInterface,
  FactoryProviderInterface,
  ProviderType,
} from "@bytium-core/common";
import { TypeOrmModuleOptions } from "@database/types/type-orm-module-options.type";
import { TypeOrmModuleAsyncOptions } from "@database/interfaces/type-orm-module-async-options.interface";
import { TypeOrmOptionsFactory } from "@database/interfaces/type-orm-options-factory.interface";
import { TypeOrmCoreService } from "@database/services/type-orm-core.service";
import { EntitiesMetadataStorage } from "@database/utils/entities-metadata.storage";
import { getDataSourceToken } from "@database/utils/get-data-source-token.utils";
import { getEntityManagerToken } from "@database/utils/get-entity-manager-token.utils";
import { getRepositoryToken } from "@database/utils/get-repository-token.utils";

function withAutoLoadedEntities(options: TypeOrmModuleOptions, dataSourceName: string): TypeOrmModuleOptions {
  if (!options.autoLoadEntities) return options;

  const declared = (Array.isArray(options.entities) ? options.entities : []) as EntityTarget<any>[];
  const auto = EntitiesMetadataStorage.getEntitiesByDataSource(dataSourceName);
  const merged: EntityTarget<any>[] = [...declared];

  for (const entity of auto) {
    if (!merged.includes(entity)) merged.push(entity);
  }

  return { ...options, entities: merged as any };
}

/**
 * Dynamic module that connects a TypeORM data source and exposes its repositories.
 */
export class TypeOrmModule {
  /** Registers a data source with static options. */
  static forRoot(options: TypeOrmModuleOptions): BytiumResourceDynamicModuleInterface {
    const dataSourceName = options.name || "default";
    const dataSourceToken = getDataSourceToken(dataSourceName);
    const entityManagerToken = getEntityManagerToken(dataSourceName);
    const dataSourceProvider: FactoryProviderInterface<DataSource> = {
      provide: dataSourceToken,
      useFactory: async (coreService: TypeOrmCoreService) => {
        return coreService.createConnection(withAutoLoadedEntities(options, dataSourceName), dataSourceName);
      },
      inject: [TypeOrmCoreService],
    };
    const entityManagerProvider: FactoryProviderInterface<EntityManager> = {
      provide: entityManagerToken,
      useFactory: (dataSource: DataSource) => dataSource.manager,
      inject: [dataSourceToken],
    };
    const providers: ProviderType[] = [TypeOrmCoreService, dataSourceProvider, entityManagerProvider];

    return {
      module: TypeOrmModule as ConstructorType,
      name: "typeOrmRootModule",
      global: options.global,
      providers,
      exports: [dataSourceToken, entityManagerToken],
    };
  }

  /** Registers a data source with options produced by a factory, class, or existing provider. */
  static forRootAsync(options: TypeOrmModuleAsyncOptions): BytiumResourceDynamicModuleInterface {
    if (!options.useFactory && !options.useClass && !options.useExisting) {
      throw new Error("TypeOrmModule.forRootAsync requires one of: useFactory, useClass, useExisting.");
    }

    const dataSourceName = options.name || "default";
    const dataSourceToken = getDataSourceToken(dataSourceName);
    const entityManagerToken = getEntityManagerToken(dataSourceName);
    const dataSourceProvider = this.buildAsyncDataSourceProvider(dataSourceName, dataSourceToken, options);
    const entityManagerProvider: FactoryProviderInterface<EntityManager> = {
      provide: entityManagerToken,
      useFactory: (dataSource: DataSource) => dataSource.manager,
      inject: [dataSourceToken],
    };
    const providers: ProviderType[] = [TypeOrmCoreService, dataSourceProvider, entityManagerProvider];

    if (options.useClass) {
      providers.push(options.useClass);
    }

    return {
      module: TypeOrmModule as ConstructorType,
      name: "typeOrmRootModule",
      imports: options.imports,
      global: options.global,
      providers,
      exports: [dataSourceToken, entityManagerToken],
    };
  }

  /** Registers repositories for the given entities on a data source. */
  static forFeature(
    entities: EntityTarget<any>[],
    dataSource?: string,
    options: { global?: boolean } = {},
  ): BytiumResourceDynamicModuleInterface {
    const dataSourceName = dataSource || "default";
    const dataSourceToken = getDataSourceToken(dataSourceName);

    EntitiesMetadataStorage.addEntitiesByDataSource(dataSourceName, entities);

    const repositoryProviders: FactoryProviderInterface<Repository<any>>[] = entities.map((entity) => ({
      provide: getRepositoryToken(entity, dataSourceName),
      useFactory: (ds: DataSource) => ds.getRepository(entity),
      inject: [dataSourceToken],
    }));

    return {
      module: TypeOrmModule as ConstructorType,
      name: "typeOrmFeatureModule",
      global: options.global,
      providers: repositoryProviders,
      exports: repositoryProviders.map((repositoryProvider) => repositoryProvider.provide),
    };
  }

  private static buildAsyncDataSourceProvider(
    dataSourceName: string,
    dataSourceToken: string,
    options: TypeOrmModuleAsyncOptions,
  ): FactoryProviderInterface<DataSource> {
    if (options.useFactory) {
      const userFactory = options.useFactory;

      return {
        provide: dataSourceToken,
        useFactory: async (coreService: TypeOrmCoreService, ...args: any[]) => {
          const config = await userFactory(...args);

          return coreService.createConnection(withAutoLoadedEntities(config, dataSourceName), dataSourceName);
        },
        inject: [TypeOrmCoreService, ...(options.inject ?? [])],
      };
    }

    const factoryClass = (options.useClass ?? options.useExisting) as ConstructorType;

    return {
      provide: dataSourceToken,
      useFactory: async (coreService: TypeOrmCoreService, factory: TypeOrmOptionsFactory) => {
        const config = await factory.createTypeOrmOptions(dataSourceName);

        return coreService.createConnection(withAutoLoadedEntities(config, dataSourceName), dataSourceName);
      },
      inject: [TypeOrmCoreService, factoryClass],
    };
  }
}
