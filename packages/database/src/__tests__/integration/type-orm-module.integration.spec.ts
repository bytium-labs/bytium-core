import "reflect-metadata";
import { Column, Entity, EntityManager, PrimaryGeneratedColumn, Repository } from "typeorm";
import { BytiumResourceModule, Injectable } from "@bytium-core/common";
import { Test } from "@bytium-core/testing";
import { TypeOrmModule } from "@database/type-orm.module";
import { TypeOrmModuleOptions } from "@database/types/type-orm-module-options.type";
import { TypeOrmCoreService } from "@database/services/type-orm-core.service";
import { InjectRepository } from "@database/decorators/inject-repository.decorator";
import { InjectDataSource } from "@database/decorators/inject-data-source.decorator";
import { InjectEntityManager } from "@database/decorators/inject-entity-manager.decorator";
import { getRepositoryToken } from "@database/utils/get-repository-token.utils";
import { EntitiesMetadataStorage } from "@database/utils/entities-metadata.storage";
import { DataSource } from "typeorm";

@Entity({ name: "dependency_provider_a" })
class DependencyEntityA {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  label!: string;
}

@Entity({ name: "dependency_provider_b" })
class DependencyEntityB {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  tag!: string;
}

describe("TypeOrmModule", () => {
  describe("forRoot", () => {
    it("should initialize a DataSource and expose TypeOrmCoreService", async () => {
      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
          }),
        ],
      }).compile();
      const typeOrmCoreServiceInstance = testingModuleInstance.get<TypeOrmCoreService>(TypeOrmCoreService);

      expect(typeOrmCoreServiceInstance).toBeInstanceOf(TypeOrmCoreService);
      expect(typeOrmCoreServiceInstance.getConnection("default").isInitialized).toBe(true);

      await testingModuleInstance.close();
    });
  });

  describe("forFeature", () => {
    it("should provide an injectable repository for the registered entity", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@InjectRepository(DependencyEntityA) public repository: Repository<DependencyEntityA>) {}
      }

      @BytiumResourceModule({
        name: "dependentModule",
        imports: [TypeOrmModule.forFeature([DependencyEntityA])],
        providers: [DependentProviderA],
      })
      class DependentModule {}

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
            global: true,
          }),
          DependentModule,
        ],
      }).compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance.repository).toBeInstanceOf(Repository);

      const inserted = await dependentProviderAInstance.repository.save({ label: "first" });
      const found = await dependentProviderAInstance.repository.findOneBy({ id: inserted.id });

      expect(found?.label).toBe("first");

      await testingModuleInstance.close();
    });
  });

  describe("forRootAsync", () => {
    it("should resolve DataSource through async useFactory", async () => {
      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRootAsync({
            useFactory: async () => ({
              type: "sqljs",
              entities: [DependencyEntityA],
              synchronize: true,
            }),
          }),
        ],
      }).compile();
      const typeOrmCoreServiceInstance = testingModuleInstance.get<TypeOrmCoreService>(TypeOrmCoreService);

      expect(typeOrmCoreServiceInstance.getConnection("default").isInitialized).toBe(true);

      await testingModuleInstance.close();
    });

    it("should resolve DataSource through async useClass options factory", async () => {
      @Injectable()
      class TypeOrmConfigService {
        createTypeOrmOptions(): TypeOrmModuleOptions {
          return {
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
          };
        }
      }

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRootAsync({
            useClass: TypeOrmConfigService,
          }),
        ],
      }).compile();
      const typeOrmCoreServiceInstance = testingModuleInstance.get<TypeOrmCoreService>(TypeOrmCoreService);

      expect(typeOrmCoreServiceInstance.getConnection("default").isInitialized).toBe(true);

      await testingModuleInstance.close();
    });

    it("should resolve DataSource through async useExisting options factory", async () => {
      @Injectable()
      class SharedConfigService {
        createTypeOrmOptions(): TypeOrmModuleOptions {
          return {
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
          };
        }
      }

      @BytiumResourceModule({
        name: "sharedModule",
        providers: [SharedConfigService],
        exports: [SharedConfigService],
      })
      class SharedModule {}

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRootAsync({
            imports: [SharedModule],
            useExisting: SharedConfigService,
          }),
        ],
      }).compile();
      const typeOrmCoreServiceInstance = testingModuleInstance.get<TypeOrmCoreService>(TypeOrmCoreService);

      expect(typeOrmCoreServiceInstance.getConnection("default").isInitialized).toBe(true);

      await testingModuleInstance.close();
    });
  });

  describe("dataSourceFactory option", () => {
    it("should use the user-provided dataSourceFactory instead of building a fresh DataSource", async () => {
      const customFactory = jest.fn(async (options) => {
        const ds = new DataSource(options);

        await ds.initialize();
        (ds as unknown as { __built_by_user: boolean }).__built_by_user = true;

        return ds;
      });
      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
            dataSourceFactory: customFactory,
          }),
        ],
      }).compile();
      const typeOrmCoreServiceInstance = testingModuleInstance.get<TypeOrmCoreService>(TypeOrmCoreService);
      const dataSourceInstance = typeOrmCoreServiceInstance.getConnection("default") as DataSource & {
        __built_by_user?: boolean;
      };

      expect(customFactory).toHaveBeenCalledTimes(1);
      expect(dataSourceInstance.__built_by_user).toBe(true);
      expect(dataSourceInstance.isInitialized).toBe(true);

      await testingModuleInstance.close();
    });
  });

  describe("retryAttempts option", () => {
    it("should retry DataSource initialization on failure up to retryAttempts times", async () => {
      let attempts = 0;
      const failingFactory = jest.fn(async () => {
        attempts++;

        if (attempts < 3) {
          throw new Error(`simulated failure on attempt ${attempts}`);
        }

        const ds = new DataSource({
          type: "sqljs",
          entities: [DependencyEntityA],
          synchronize: true,
        });

        await ds.initialize();

        return ds;
      });
      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
            retryAttempts: 5,
            retryDelay: 1,
            dataSourceFactory: failingFactory,
          }),
        ],
      }).compile();

      expect(failingFactory).toHaveBeenCalledTimes(3);

      const typeOrmCoreServiceInstance = testingModuleInstance.get<TypeOrmCoreService>(TypeOrmCoreService);

      expect(typeOrmCoreServiceInstance.getConnection("default").isInitialized).toBe(true);

      await testingModuleInstance.close();
    });
  });

  describe("autoLoadEntities option", () => {
    beforeEach(() => {
      EntitiesMetadataStorage.clear();
    });

    it("should pull entities registered through forFeature into the DataSource when autoLoadEntities is true", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@InjectRepository(DependencyEntityA) public repository: Repository<DependencyEntityA>) {}
      }

      @BytiumResourceModule({
        name: "dependentModule",
        imports: [TypeOrmModule.forFeature([DependencyEntityA])],
        providers: [DependentProviderA],
      })
      class DependentModule {}

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "sqljs",
            // NOTE: no `entities` here - autoLoadEntities pulls them from forFeature side effects
            synchronize: true,
            autoLoadEntities: true,
            global: true,
          }),
          DependentModule,
        ],
      }).compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);
      const saved = await dependentProviderAInstance.repository.save({ label: "auto-loaded" });
      const found = await dependentProviderAInstance.repository.findOneBy({ id: saved.id });

      expect(found?.label).toBe("auto-loaded");

      await testingModuleInstance.close();
    });

    it("should respect autoLoadEntities=false by initializing the DataSource only with declared entities", async () => {
      @BytiumResourceModule({
        name: "dependentModule",
        imports: [TypeOrmModule.forFeature([DependencyEntityB])],
      })
      class DependentModule {}

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
            // autoLoadEntities omitted (defaults to false) - DependencyEntityB stays in storage but is NOT applied
            global: true,
          }),
          DependentModule,
        ],
      }).compile();
      const typeOrmCoreServiceInstance = testingModuleInstance.get<TypeOrmCoreService>(TypeOrmCoreService);
      const dataSourceInstance = typeOrmCoreServiceInstance.getConnection("default");
      const registeredTargets = dataSourceInstance.entityMetadatas.map((m) => m.target);

      expect(registeredTargets).toContain(DependencyEntityA);
      expect(registeredTargets).not.toContain(DependencyEntityB);

      await testingModuleInstance.close();
    });
  });

  describe("multiple named connections", () => {
    it("should keep distinct DataSources for forRoot calls with different name", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(
          @InjectDataSource("primary") public primaryDataSource: DataSource,
          @InjectDataSource("secondary") public secondaryDataSource: DataSource,
        ) {}
      }

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
            name: "primary",
            global: true,
          }),
          TypeOrmModule.forRoot({
            type: "sqljs",
            entities: [DependencyEntityB],
            synchronize: true,
            name: "secondary",
            global: true,
          }),
        ],
        providers: [DependentProviderA],
      }).compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);

      expect(dependentProviderAInstance.primaryDataSource.isInitialized).toBe(true);
      expect(dependentProviderAInstance.primaryDataSource.options.type).toBe("sqljs");

      expect(dependentProviderAInstance.secondaryDataSource.isInitialized).toBe(true);

      expect(dependentProviderAInstance.primaryDataSource).not.toBe(dependentProviderAInstance.secondaryDataSource);

      await testingModuleInstance.close();
    });
  });

  describe("EntityManager injection", () => {
    it("should inject the default EntityManager via @InjectEntityManager()", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@InjectEntityManager() public entityManager: EntityManager) {}
      }

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
          }),
        ],
        providers: [DependentProviderA],
      }).compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);

      expect(dependentProviderAInstance.entityManager).toBeInstanceOf(EntityManager);

      const saved = await dependentProviderAInstance.entityManager.save(DependencyEntityA, { label: "via-em" });
      const found = await dependentProviderAInstance.entityManager.findOneBy(DependencyEntityA, { id: saved.id });

      expect(found?.label).toBe("via-em");

      await testingModuleInstance.close();
    });

    it("should inject a named EntityManager via @InjectEntityManager('name')", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@InjectEntityManager("primary") public primaryEntityManager: EntityManager) {}
      }

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
            name: "primary",
            global: true,
          }),
        ],
        providers: [DependentProviderA],
      }).compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);

      expect(dependentProviderAInstance.primaryEntityManager).toBeInstanceOf(EntityManager);

      await testingModuleInstance.close();
    });
  });

  describe("getRepositoryToken helper", () => {
    it("should produce distinct tokens for the same entity scoped to different connections", () => {
      const defaultToken = getRepositoryToken(DependencyEntityA);
      const namedToken = getRepositoryToken(DependencyEntityA, "primary");

      expect(defaultToken).toBe("Repository_DependencyEntityA");
      expect(namedToken).toBe("Repository_primary_DependencyEntityA");
      expect(defaultToken).not.toBe(namedToken);
    });

    it("should let @InjectRepository(Entity, 'name') resolve a repository from a named connection", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@InjectRepository(DependencyEntityA, "primary") public repository: Repository<DependencyEntityA>) {}
      }

      @BytiumResourceModule({
        name: "dependentModule",
        imports: [TypeOrmModule.forFeature([DependencyEntityA], "primary")],
        providers: [DependentProviderA],
      })
      class DependentModule {}

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
            name: "primary",
            global: true,
          }),
          DependentModule,
        ],
      }).compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);

      expect(dependentProviderAInstance.repository).toBeInstanceOf(Repository);

      const saved = await dependentProviderAInstance.repository.save({ label: "from-named" });
      const found = await dependentProviderAInstance.repository.findOneBy({ id: saved.id });

      expect(found?.label).toBe("from-named");

      await testingModuleInstance.close();
    });
  });

  describe("onModuleDestroy", () => {
    it("should close DataSources cleanly on testing module close", async () => {
      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: "sqljs",
            entities: [DependencyEntityA],
            synchronize: true,
          }),
        ],
      }).compile();
      const typeOrmCoreServiceInstance = testingModuleInstance.get<TypeOrmCoreService>(TypeOrmCoreService);
      const dataSourceInstance = typeOrmCoreServiceInstance.getConnection("default");

      expect(dataSourceInstance.isInitialized).toBe(true);

      await testingModuleInstance.close();

      expect(dataSourceInstance.isInitialized).toBe(false);
    });
  });
});
