import {
  BytiumProviderScopeEnum,
  BytiumResource,
  BytiumResourceDynamicModuleInterface,
  BytiumResourceModule,
  Controller,
  DependencyOutOfScopeException,
  DependencyUndefinedException,
  DuplicateProviderException,
  forwardRef,
  Global,
  Inject,
  Injectable,
  ModuleRef,
  Optional,
  TransientProviderGetException,
  WrongDependencyTypeException,
} from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { BytiumCoreModule } from "@core/modules/bytium-core.module";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType } from "@shared";

describe("Modules resolution", () => {
  let dependencyGraph: DependencyGraph;
  let dependencyManager: BytiumDependencyManager;
  const getInstance = <T>(token: GraphTokenType, module: ConstructorType): T | undefined => {
    const moduleNode = dependencyGraph.findModuleNode(module);

    return moduleNode ? (resolveVisibleInstance(dependencyGraph, token, moduleNode)?.instance as T) : undefined;
  };

  beforeEach(() => {
    dependencyGraph = new DependencyGraph();
    dependencyManager = new BytiumDependencyManager(dependencyGraph);
  });

  afterEach(() => {
    dependencyManager.destroyAll();
  });

  describe("basic module resolution", () => {
    it("should resolve module with no imports", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance(DependencyProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
    });

    it("should resolve module with single import", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "importedModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ImportedModuleA {}

      @BytiumResourceModule({
        name: "testModule",
        imports: [ImportedModuleA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance(DependencyProviderA, ImportedModuleA);
      const importedDependencyProviderAInstance = getInstance(DependencyProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(importedDependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
    });

    it("should resolve module with multiple imports", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependencyProviderB {}

      @BytiumResourceModule({
        name: "importedModuleA",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ImportedModuleA {}

      @BytiumResourceModule({
        name: "importedModuleB",
        providers: [DependencyProviderB],
        exports: [DependencyProviderB],
      })
      class ImportedModuleB {}

      @BytiumResourceModule({
        name: "testModule",
        imports: [ImportedModuleA, ImportedModuleB],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance(DependencyProviderA, ImportedModuleA);
      const dependencyProviderBInstance = getInstance(DependencyProviderB, ImportedModuleB);
      const importedDependencyProviderAInstance = getInstance(DependencyProviderA, TestModule);
      const importedDependencyProviderBInstance = getInstance(DependencyProviderB, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependencyProviderBInstance).toBeInstanceOf(DependencyProviderB);

      expect(importedDependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(importedDependencyProviderBInstance).toBeInstanceOf(DependencyProviderB);
    });

    it("should throw when @BytiumResourceModule is missing", async () => {
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(WrongDependencyTypeException);
    });

    it("should resolve an empty module with no providers, imports, or controllers", async () => {
      @BytiumResourceModule({ name: "testModule" })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const testModuleNode = dependencyGraph.getNode(TestModule);

      expect(testModuleNode).toBeDefined();
      expect(testModuleNode?.instances).toHaveLength(1);
    });

    it("should resolve a resource declaring an empty modules array", async () => {
      @BytiumResource({ modules: [] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const testResourceNode = dependencyGraph.getNode(TestResource);

      expect(testResourceNode).toBeDefined();
      expect(testResourceNode?.instances).toHaveLength(1);
    });

    it("should resolve a module that declares only controllers and no providers", async () => {
      @Controller()
      class ControllerProviderA {}

      @BytiumResourceModule({
        name: "testModule",
        controllers: [ControllerProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const controllerProviderAInstance = dependencyGraph
        .getNode(ControllerProviderA)
        ?.instances.find((entry) => !entry.isAlias)?.instance;

      expect(controllerProviderAInstance).toBeInstanceOf(ControllerProviderA);
    });

    it("should resolve a module that imports itself through forwardRef without entering an infinite loop", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "testModule",
        imports: [forwardRef(() => TestModule)],
        providers: [DependencyProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
    });

    it("should treat the same module appearing twice in resource.modules as a single instance", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule, TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const testModuleNode = dependencyGraph.getNode(TestModule);
      const dependencyProviderANode = dependencyGraph.getNode(DependencyProviderA);

      expect(testModuleNode?.instances).toHaveLength(1);

      expect(dependencyProviderANode?.instances).toHaveLength(1);
    });

    it("should resolve a provider declared via forwardRef in the providers array", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "testModule",
        providers: [forwardRef(() => DependencyProviderA)],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
    });
  });

  describe("module scope", () => {
    it("should isolate providers between different modules", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependencyProviderB {}

      @BytiumResourceModule({
        name: "moduleA",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ModuleA {}

      @BytiumResourceModule({
        name: "moduleB",
        providers: [DependencyProviderB],
        exports: [DependencyProviderB],
      })
      class ModuleB {}

      @BytiumResource({
        modules: [ModuleA, ModuleB],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance(DependencyProviderA, ModuleA);
      const dependencyProviderBInstance = getInstance(DependencyProviderB, ModuleB);
      const importedDependencyProviderAInstance = getInstance(DependencyProviderA, ModuleB);
      const importedDependencyProviderBInstance = getInstance(DependencyProviderB, ModuleA);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependencyProviderBInstance).toBeInstanceOf(DependencyProviderB);

      expect(importedDependencyProviderAInstance).toBeUndefined();

      expect(importedDependencyProviderBInstance).toBeUndefined();
    });

    it("should create separate instances of the same provider class declared in different modules", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "moduleA",
        providers: [DependencyProviderA],
      })
      class ModuleA {}

      @BytiumResourceModule({
        name: "moduleB",
        providers: [DependencyProviderA],
      })
      class ModuleB {}

      @BytiumResource({
        modules: [ModuleA, ModuleB],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const moduleADependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, ModuleA);
      const moduleBDependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, ModuleB);

      expect(moduleADependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(moduleADependencyProviderAInstance).not.toBe(moduleBDependencyProviderAInstance);

      expect(moduleBDependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
    });

    it("should throw when the same custom-provider token is registered in two different modules", async () => {
      const SHARED_TOKEN = "SHARED_TOKEN";

      @BytiumResourceModule({
        name: "moduleA",
        providers: [{ provide: SHARED_TOKEN, useValue: "valueA" }],
      })
      class ModuleA {}

      @BytiumResourceModule({
        name: "moduleB",
        providers: [{ provide: SHARED_TOKEN, useValue: "valueB" }],
      })
      class ModuleB {}

      @BytiumResource({
        modules: [ModuleA, ModuleB],
      })
      class TestResource {}

      const error = await dependencyManager.resolve(TestResource).catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(DuplicateProviderException);
      expect((error as Error).message).toMatch(/Duplicate provider "SHARED_TOKEN"/);
    });

    it("should export single provider and make it available to importing modules", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "exportingModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ExportingModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [ExportingModule],
        providers: [DependentProviderA],
      })
      class ImportingModule {}

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, ExportingModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, ImportingModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should export multiple providers and make them available to importing modules", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependencyProviderB {}

      @Injectable()
      class DependentProviderA {
        constructor(
          public dependencyProviderA: DependencyProviderA,
          public dependencyProviderB: DependencyProviderB,
        ) {}
      }

      @BytiumResourceModule({
        name: "exportingModule",
        providers: [DependencyProviderA, DependencyProviderB],
        exports: [DependencyProviderA, DependencyProviderB],
      })
      class ExportingModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [ExportingModule],
        providers: [DependentProviderA],
      })
      class ImportingModule {}

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, ExportingModule);
      const dependencyProviderBInstance = getInstance<DependencyProviderB>(DependencyProviderB, ExportingModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, ImportingModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependencyProviderBInstance).toBeInstanceOf(DependencyProviderB);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
      expect(dependentProviderAInstance?.dependencyProviderB).toBe(dependencyProviderBInstance);
    });

    it("should re-export imported providers and make them available to other importing modules", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "baseModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class BaseModule {}

      @BytiumResourceModule({
        name: "middleModule",
        imports: [BaseModule],
        exports: [BaseModule],
      })
      class MiddleModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [MiddleModule],
        providers: [DependentProviderA],
      })
      class ImportingModule {}

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, BaseModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, ImportingModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should resolve a provider through a three-level transitive re-export chain", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "baseModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class BaseModule {}

      @BytiumResourceModule({
        name: "middleModule",
        imports: [BaseModule],
        exports: [BaseModule],
      })
      class MiddleModule {}

      @BytiumResourceModule({
        name: "upperModule",
        imports: [MiddleModule],
        exports: [MiddleModule],
      })
      class UpperModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [UpperModule],
        providers: [DependentProviderA],
      })
      class ImportingModule {}

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, BaseModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, ImportingModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should throw when a re-export chain is broken and the provider is not visible downstream", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "baseModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class BaseModule {}

      @BytiumResourceModule({
        name: "middleModule",
        imports: [BaseModule],
        exports: [BaseModule],
      })
      class MiddleModule {}

      @BytiumResourceModule({
        name: "upperModule",
        imports: [MiddleModule],
      })
      class UpperModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [UpperModule],
        providers: [DependentProviderA],
      })
      class ImportingModule {}

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyOutOfScopeException);
    });

    it("should resolve a provider exported via forwardRef", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "exportingModule",
        providers: [DependencyProviderA],
        exports: [forwardRef(() => DependencyProviderA)],
      })
      class ExportingModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [ExportingModule],
        providers: [DependentProviderA],
      })
      class ImportingModule {}

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, ExportingModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, ImportingModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should export a custom provider and make it available to importing modules", async () => {
      const CONFIG_TOKEN = "CONFIG";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(CONFIG_TOKEN) public config: { ready: boolean }) {}
      }

      @BytiumResourceModule({
        name: "exportingModule",
        providers: [{ provide: CONFIG_TOKEN, useValue: { ready: true } }],
        exports: [CONFIG_TOKEN],
      })
      class ExportingModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [ExportingModule],
        providers: [DependentProviderA],
      })
      class ImportingModule {}

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, ImportingModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.config).toEqual({ ready: true });
    });
  });

  describe("module class constructor injection", () => {
    it("should inject a provider from its own providers into the module class constructor", async () => {
      @Injectable()
      class DependencyProviderA {
        public marker = "from-own-provider";
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA],
      })
      class TestModule {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const testModuleNode = dependencyGraph.findModuleNode(TestModule);
      const testModuleInstance = testModuleNode?.instances[0]?.instance as TestModule;

      expect(testModuleInstance).toBeInstanceOf(TestModule);
      expect(testModuleInstance?.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
      expect(testModuleInstance?.dependencyProviderA.marker).toBe("from-own-provider");
    });

    it("should inject a provider exported by an imported module into the module class constructor", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "exportingModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ExportingModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [ExportingModule],
      })
      class ImportingModule {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const importingModuleNode = dependencyGraph.findModuleNode(ImportingModule);
      const importingModuleInstance = importingModuleNode?.instances[0]?.instance as ImportingModule;
      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, ExportingModule);

      expect(importingModuleInstance).toBeInstanceOf(ImportingModule);
      expect(importingModuleInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should inject undefined for an @Optional module-class constructor dependency that is not registered", async () => {
      const MISSING_TOKEN = "MISSING_TOKEN";

      @BytiumResourceModule({
        name: "testModule",
      })
      class TestModule {
        constructor(@Optional() @Inject(MISSING_TOKEN) public maybeValue?: string) {}
      }

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const testModuleNode = dependencyGraph.findModuleNode(TestModule);
      const testModuleInstance = testModuleNode?.instances[0]?.instance as TestModule;

      expect(testModuleInstance).toBeInstanceOf(TestModule);
      expect(testModuleInstance?.maybeValue).toBeUndefined();
    });

    it("should throw when a module class constructor dependency is not a registered provider", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "testModule",
      })
      class TestModule {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should throw when a module class constructor dependency is not accessible from its scope", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "exportingModule",
        providers: [DependencyProviderA],
      })
      class ExportingModule {}

      @BytiumResourceModule({
        name: "importingModule",
      })
      class ImportingModule {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResource({
        modules: [ExportingModule, ImportingModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyOutOfScopeException);
    });
  });

  describe("dynamic modules", () => {
    it("should resolve providers declared in a dynamic module returned by forRoot", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({ name: "dynamicBase" })
      class DynamicTestModule {
        static forRoot(): BytiumResourceDynamicModuleInterface {
          return {
            module: DynamicTestModule,
            name: "dynamicTest",
            providers: [DependencyProviderA],
            exports: [DependencyProviderA],
          };
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        imports: [DynamicTestModule.forRoot()],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, DynamicTestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
    });

    it("should make the dynamic module's exported provider available to importing modules", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({ name: "dynamicBase" })
      class DynamicTestModule {
        static forRoot(): BytiumResourceDynamicModuleInterface {
          return {
            module: DynamicTestModule,
            name: "dynamicTest",
            providers: [DependencyProviderA],
            exports: [DependencyProviderA],
          };
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        imports: [DynamicTestModule.forRoot()],
        providers: [DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, DynamicTestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should pass forRoot config to providers through a useValue token", async () => {
      const DYNAMIC_CONFIG_TOKEN = "DYNAMIC_CONFIG";

      interface DynamicConfig {
        flag: boolean;
      }

      @Injectable()
      class DependencyProviderA {
        constructor(@Inject(DYNAMIC_CONFIG_TOKEN) public config: DynamicConfig) {}
      }

      @BytiumResourceModule({ name: "dynamicBase" })
      class DynamicTestModule {
        static forRoot(config: DynamicConfig): BytiumResourceDynamicModuleInterface {
          return {
            module: DynamicTestModule,
            name: "dynamicTest",
            providers: [DependencyProviderA, { provide: DYNAMIC_CONFIG_TOKEN, useValue: config }],
            exports: [DependencyProviderA],
          };
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        imports: [DynamicTestModule.forRoot({ flag: true })],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, DynamicTestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.config).toEqual({ flag: true });
    });

    it("should resolve providers from a module imported by the dynamic module's own imports field", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "innerModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class InnerModule {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({ name: "dynamicBase" })
      class DynamicTestModule {
        static forRoot(): BytiumResourceDynamicModuleInterface {
          return {
            module: DynamicTestModule,
            name: "dynamicTest",
            imports: [InnerModule],
            providers: [DependentProviderA],
            exports: [DependentProviderA],
          };
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        imports: [DynamicTestModule.forRoot()],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, InnerModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, DynamicTestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should treat dynamic module as global when forRoot returns global: true", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({ name: "dynamicBase" })
      class GlobalDynamicModule {
        static forRoot(): BytiumResourceDynamicModuleInterface {
          return {
            module: GlobalDynamicModule,
            name: "globalDynamic",
            global: true,
            providers: [DependencyProviderA],
            exports: [DependencyProviderA],
          };
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [GlobalDynamicModule.forRoot(), TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, GlobalDynamicModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should resolve a dynamic module's config via async useFactory with injected dependencies (forRootAsync useFactory pattern)", async () => {
      const DYNAMIC_CONFIG_TOKEN = "DYNAMIC_CONFIG";

      interface DynamicConfig {
        host: string;
      }

      @Injectable()
      class DependencyProviderB {
        readonly host = "example.local";
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(DYNAMIC_CONFIG_TOKEN) public config: DynamicConfig) {}
      }

      @BytiumResourceModule({
        name: "baseModule",
        providers: [DependencyProviderB],
        exports: [DependencyProviderB],
      })
      class BaseModule {}

      @BytiumResourceModule({ name: "dynamicBase" })
      class DynamicTestModule {
        static forRootAsync(): BytiumResourceDynamicModuleInterface {
          return {
            module: DynamicTestModule,
            name: "dynamicTest",
            imports: [BaseModule],
            providers: [
              DependentProviderA,
              {
                provide: DYNAMIC_CONFIG_TOKEN,
                useFactory: async (dependencyProviderBInstance: DependencyProviderB) => ({
                  host: dependencyProviderBInstance.host,
                }),
                inject: [DependencyProviderB],
              },
            ],
            exports: [DependentProviderA],
          };
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        imports: [DynamicTestModule.forRootAsync()],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, DynamicTestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.config).toEqual({ host: "example.local" });
    });

    it("should resolve a dynamic module's exported alias via useExisting (forRootAsync useExisting pattern)", async () => {
      const DYNAMIC_CONFIG_TOKEN = "DYNAMIC_CONFIG";

      @Injectable()
      class DependencyProviderB {
        readonly host = "via-existing.local";
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(DYNAMIC_CONFIG_TOKEN) public config: DependencyProviderB) {}
      }

      @BytiumResourceModule({ name: "dynamicBase" })
      class DynamicTestModule {
        static forRootAsync(): BytiumResourceDynamicModuleInterface {
          return {
            module: DynamicTestModule,
            name: "dynamicTest",
            providers: [
              DependencyProviderB,
              { provide: DYNAMIC_CONFIG_TOKEN, useExisting: DependencyProviderB },
              DependentProviderA,
            ],
            exports: [DependentProviderA],
          };
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        imports: [DynamicTestModule.forRootAsync()],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderBInstance = getInstance<DependencyProviderB>(DependencyProviderB, DynamicTestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, DynamicTestModule);

      expect(dependencyProviderBInstance).toBeInstanceOf(DependencyProviderB);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.config).toBe(dependencyProviderBInstance);
      expect(dependentProviderAInstance?.config.host).toBe("via-existing.local");
    });

    it("should resolve a dynamic module's config via a useClass options factory (forRootAsync useClass pattern)", async () => {
      const DYNAMIC_CONFIG_TOKEN = "DYNAMIC_CONFIG";

      interface DynamicConfig {
        host: string;
      }

      interface DynamicConfigFactoryInterface {
        createDynamicConfig(): Promise<DynamicConfig> | DynamicConfig;
      }

      @Injectable()
      class DependencyProviderB implements DynamicConfigFactoryInterface {
        async createDynamicConfig(): Promise<DynamicConfig> {
          return { host: "from-class.local" };
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(DYNAMIC_CONFIG_TOKEN) public config: DynamicConfig) {}
      }

      @BytiumResourceModule({ name: "dynamicBase" })
      class DynamicTestModule {
        static forRootAsync(): BytiumResourceDynamicModuleInterface {
          return {
            module: DynamicTestModule,
            name: "dynamicTest",
            providers: [
              DependencyProviderB,
              DependentProviderA,
              {
                provide: DYNAMIC_CONFIG_TOKEN,
                useFactory: (dependencyProviderBInstance: DependencyProviderB) =>
                  dependencyProviderBInstance.createDynamicConfig(),
                inject: [DependencyProviderB],
              },
            ],
            exports: [DependentProviderA],
          };
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        imports: [DynamicTestModule.forRootAsync()],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, DynamicTestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.config).toEqual({ host: "from-class.local" });
    });
  });

  describe("ModuleRef", () => {
    it("should be injectable into any provider and return a resolved instance via get()", async () => {
      @Injectable()
      class DependencyProviderA {
        public marker = "lookup-target";
      }

      @Injectable()
      class DependentProviderA {
        constructor(public moduleRef: ModuleRef) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const resolvedDependency = dependentProviderAInstance?.moduleRef.get<DependencyProviderA>(DependencyProviderA);

      expect(dependentProviderAInstance?.moduleRef).toBeInstanceOf(ModuleRef);
      expect(resolvedDependency).toBeInstanceOf(DependencyProviderA);
      expect(resolvedDependency?.marker).toBe("lookup-target");
    });

    it("should reach another module's own providers through select()", async () => {
      @Injectable()
      class DependencyProviderB {
        public marker = "in-module-b";
      }

      @BytiumResourceModule({
        name: "testModuleB",
        providers: [DependencyProviderB],
      })
      class TestModuleB {}

      @Injectable()
      class DependentProviderA {
        constructor(public moduleRef: ModuleRef) {}
      }

      @BytiumResourceModule({
        name: "testModuleA",
        providers: [DependentProviderA],
      })
      class TestModuleA {}

      @BytiumResource({
        modules: [TestModuleA, TestModuleB],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModuleA);
      const selectedDependencyProviderB = dependentProviderAInstance?.moduleRef
        .select(TestModuleB)
        .get<DependencyProviderB>(DependencyProviderB);

      expect(() => dependentProviderAInstance?.moduleRef.get(DependencyProviderB)).toThrow(
        DependencyOutOfScopeException,
      );

      expect(selectedDependencyProviderB).toBeInstanceOf(DependencyProviderB);
      expect(selectedDependencyProviderB?.marker).toBe("in-module-b");
    });

    it("should expose has() and throw from get() when the token has no resolved instance", async () => {
      const UNKNOWN_TOKEN = "UNKNOWN_TOKEN";

      @Injectable()
      class DependentProviderA {
        constructor(public moduleRef: ModuleRef) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance?.moduleRef.has(UNKNOWN_TOKEN)).toBe(false);
      expect(() => dependentProviderAInstance?.moduleRef.get(UNKNOWN_TOKEN)).toThrow(DependencyUndefinedException);
    });

    it("should create a fresh instance every time resolve() is called for a TRANSIENT provider", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        public createdAt = Math.random();
      }

      @Injectable()
      class DependentProviderA {
        constructor(public moduleRef: ModuleRef) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [TransientProviderA, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const firstTransient =
        await dependentProviderAInstance?.moduleRef.resolve<TransientProviderA>(TransientProviderA);
      const secondTransient =
        await dependentProviderAInstance?.moduleRef.resolve<TransientProviderA>(TransientProviderA);

      expect(firstTransient).toBeInstanceOf(TransientProviderA);

      expect(secondTransient).toBeInstanceOf(TransientProviderA);
      expect(secondTransient).not.toBe(firstTransient);
    });

    it("should instantiate an unregistered class via create() with constructor dependencies resolved from the graph", async () => {
      @Injectable()
      class DependencyProviderA {
        public marker = "from-graph";
      }

      @Injectable()
      class DependentProviderA {
        constructor(public moduleRef: ModuleRef) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      @Injectable()
      class AdHocService {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        whoAmI() {
          return this.dependencyProviderA.marker;
        }
      }

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const adHocInstance = await dependentProviderAInstance?.moduleRef.create<AdHocService>(AdHocService);

      expect(adHocInstance).toBeInstanceOf(AdHocService);
      expect(adHocInstance?.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
      expect(adHocInstance?.whoAmI()).toBe("from-graph");
    });

    it("should throw DependencyOutOfScopeException from strict get() when the token is registered but not in scope", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public moduleRef: ModuleRef) {}
      }

      @BytiumResourceModule({
        name: "isolatedModule",
        providers: [DependencyProviderA],
      })
      class IsolatedModule {}

      @BytiumResourceModule({
        name: "dependentModule",
        providers: [DependentProviderA],
      })
      class DependentModule {}

      @BytiumResource({
        modules: [IsolatedModule, DependentModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, DependentModule);

      expect(() => dependentProviderAInstance?.moduleRef.get(DependencyProviderA)).toThrow(
        DependencyOutOfScopeException,
      );
      expect(() => dependentProviderAInstance?.moduleRef.get(DependencyProviderA, { strict: true })).toThrow(
        DependencyOutOfScopeException,
      );

      expect(dependentProviderAInstance?.moduleRef.has(DependencyProviderA)).toBe(false);
      expect(dependentProviderAInstance?.moduleRef.has(DependencyProviderA, { strict: false })).toBe(true);
    });

    it("should bypass scope rules with get(token, { strict: false }) and return the global instance", async () => {
      @Injectable()
      class DependencyProviderA {
        public marker = "isolated-instance";
      }

      @Injectable()
      class DependentProviderA {
        constructor(public moduleRef: ModuleRef) {}
      }

      @BytiumResourceModule({
        name: "isolatedModule",
        providers: [DependencyProviderA],
      })
      class IsolatedModule {}

      @BytiumResourceModule({
        name: "dependentModule",
        providers: [DependentProviderA],
      })
      class DependentModule {}

      @BytiumResource({
        modules: [IsolatedModule, DependentModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, DependentModule);
      const leaked = dependentProviderAInstance?.moduleRef.get<DependencyProviderA>(DependencyProviderA, {
        strict: false,
      });

      expect(leaked).toBeInstanceOf(DependencyProviderA);
      expect(leaked?.marker).toBe("isolated-instance");
    });

    it("should enforce strict scope when its owner is BytiumCoreModule and the token lives in a downstream user module", async () => {
      @Injectable()
      class DependencyProviderA {
        public readonly marker = "user-module-instance";
      }

      @Injectable()
      class ScopeProbe {
        constructor(readonly moduleRef: ModuleRef) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA, ScopeProbe],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const scopeProbeInstance = getInstance<ScopeProbe>(ScopeProbe, TestModule)!;
      const coreScopedModuleRef = scopeProbeInstance.moduleRef.select(BytiumCoreModule);

      expect(() => coreScopedModuleRef.get(DependencyProviderA)).toThrow(DependencyOutOfScopeException);

      expect(coreScopedModuleRef.has(DependencyProviderA)).toBe(false);
      expect(coreScopedModuleRef.has(DependencyProviderA, { strict: false })).toBe(true);

      const leaked = coreScopedModuleRef.get<DependencyProviderA>(DependencyProviderA, { strict: false });

      expect(leaked).toBeInstanceOf(DependencyProviderA);
      expect(leaked.marker).toBe("user-module-instance");
    });

    it("should return the instance owned by the dependent's own module, not the first-resolved instance", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public moduleRef: ModuleRef) {}
      }

      @BytiumResourceModule({
        name: "moduleA",
        providers: [DependencyProviderA],
      })
      class ModuleA {}

      @BytiumResourceModule({
        name: "moduleB",
        providers: [DependencyProviderA, DependentProviderA],
      })
      class ModuleB {}

      @BytiumResource({
        modules: [ModuleA, ModuleB],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, ModuleB);
      const moduleAOwnedInstance = getInstance<DependencyProviderA>(DependencyProviderA, ModuleA);
      const moduleBOwnedInstance = getInstance<DependencyProviderA>(DependencyProviderA, ModuleB);
      const resolvedViaGet = dependentProviderAInstance?.moduleRef.get<DependencyProviderA>(DependencyProviderA);

      expect(moduleAOwnedInstance).not.toBe(moduleBOwnedInstance);

      expect(resolvedViaGet).toBe(moduleBOwnedInstance);
      expect(resolvedViaGet).not.toBe(moduleAOwnedInstance);
    });

    it("should resolve() the singleton instance owned by the dependent's own module", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public moduleRef: ModuleRef) {}
      }

      @BytiumResourceModule({
        name: "moduleA",
        providers: [DependencyProviderA],
      })
      class ModuleA {}

      @BytiumResourceModule({
        name: "moduleB",
        providers: [DependencyProviderA, DependentProviderA],
      })
      class ModuleB {}

      @BytiumResource({
        modules: [ModuleA, ModuleB],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, ModuleB);
      const moduleAOwnedInstance = getInstance<DependencyProviderA>(DependencyProviderA, ModuleA);
      const moduleBOwnedInstance = getInstance<DependencyProviderA>(DependencyProviderA, ModuleB);
      const resolvedViaResolve =
        await dependentProviderAInstance?.moduleRef.resolve<DependencyProviderA>(DependencyProviderA);

      expect(moduleAOwnedInstance).not.toBe(moduleBOwnedInstance);

      expect(resolvedViaResolve).toBe(moduleBOwnedInstance);
      expect(resolvedViaResolve).not.toBe(moduleAOwnedInstance);
    });

    it("should throw TransientProviderGetException from get() on a transient and direct to resolve()", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(
          public moduleRef: ModuleRef,
          public transientProviderA: TransientProviderA,
        ) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [TransientProviderA, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(() => dependentProviderAInstance?.moduleRef.get(TransientProviderA)).toThrow(
        TransientProviderGetException,
      );
    });
  });

  describe("global modules", () => {
    it("should make providers of a @Global module accessible without explicit imports", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Global()
      @BytiumResourceModule({
        name: "globalModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class GlobalModule {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [GlobalModule, TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, GlobalModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should propagate @Global module providers across nested module trees", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Global()
      @BytiumResourceModule({
        name: "globalModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class GlobalModule {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "leafModule",
        providers: [DependentProviderA],
      })
      class LeafModule {}

      @BytiumResourceModule({
        name: "middleModule",
        imports: [LeafModule],
      })
      class MiddleModule {}

      @BytiumResourceModule({
        name: "rootModule",
        imports: [MiddleModule],
      })
      class RootModule {}

      @BytiumResource({
        modules: [GlobalModule, RootModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, GlobalModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, LeafModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should not leak non-exported providers from a @Global module", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependencyProviderB {}

      @Global()
      @BytiumResourceModule({
        name: "globalModule",
        providers: [DependencyProviderA, DependencyProviderB],
        exports: [DependencyProviderA],
      })
      class GlobalModule {}

      @BytiumResourceModule({ name: "testModule" })
      class TestModule {}

      @BytiumResource({
        modules: [GlobalModule, TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAFromTestModule = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependencyProviderBFromTestModule = getInstance<DependencyProviderB>(DependencyProviderB, TestModule);

      expect(dependencyProviderAFromTestModule).toBeInstanceOf(DependencyProviderA);

      expect(dependencyProviderBFromTestModule).toBeUndefined();
    });

    it("should still respect @Global when the module is re-exported through another module", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Global()
      @BytiumResourceModule({
        name: "globalModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class GlobalModule {}

      @BytiumResourceModule({
        name: "middleModule",
        imports: [GlobalModule],
        exports: [GlobalModule],
      })
      class MiddleModule {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "dependentModule",
        imports: [MiddleModule],
        providers: [DependentProviderA],
      })
      class DependentModule {}

      @BytiumResourceModule({
        name: "unrelatedModule",
        providers: [DependentProviderA],
      })
      class UnrelatedModule {}

      @BytiumResource({
        modules: [GlobalModule, DependentModule, UnrelatedModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, GlobalModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, DependentModule);
      const unrelatedDependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, UnrelatedModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);

      expect(unrelatedDependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should treat dynamic module as global when @Global() is on its class and forRoot omits global", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Global()
      @BytiumResourceModule({ name: "globalDynamicBase" })
      class GlobalDynamicModule {
        static forRoot(): BytiumResourceDynamicModuleInterface {
          return {
            module: GlobalDynamicModule,
            name: "globalDynamicModule",
            providers: [DependencyProviderA],
            exports: [DependencyProviderA],
          };
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "dependentModule",
        providers: [DependentProviderA],
      })
      class DependentModule {}

      @BytiumResource({
        modules: [GlobalDynamicModule.forRoot(), DependentModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, DependentModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
    });

    it("should let forRoot({ global: false }) explicitly override @Global() decorator", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Global()
      @BytiumResourceModule({ name: "globalDynamicBase" })
      class GlobalDynamicModule {
        static forRoot(): BytiumResourceDynamicModuleInterface {
          return {
            module: GlobalDynamicModule,
            name: "globalDynamicModule",
            global: false,
            providers: [DependencyProviderA],
            exports: [DependencyProviderA],
          };
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "dependentModule",
        providers: [DependentProviderA],
      })
      class DependentModule {}

      @BytiumResource({
        modules: [GlobalDynamicModule.forRoot(), DependentModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(/DependencyProviderA/);
    });
  });

  describe("forwardRef between modules", () => {
    it("should resolve circular module imports via forwardRef on both sides", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependencyProviderB {}

      @BytiumResourceModule({
        name: "moduleA",
        imports: [forwardRef(() => ModuleB)],
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ModuleA {}

      @BytiumResourceModule({
        name: "moduleB",
        imports: [forwardRef(() => ModuleA)],
        providers: [DependencyProviderB],
        exports: [DependencyProviderB],
      })
      class ModuleB {}

      @BytiumResource({
        modules: [ModuleA, ModuleB],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, ModuleA);
      const dependencyProviderBInstance = getInstance<DependencyProviderB>(DependencyProviderB, ModuleB);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependencyProviderBInstance).toBeInstanceOf(DependencyProviderB);
    });

    it("should let providers cross module boundaries through a forwardRef-ed import", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "moduleA",
        imports: [forwardRef(() => ModuleB)],
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ModuleA {}

      @BytiumResourceModule({
        name: "moduleB",
        imports: [forwardRef(() => ModuleA)],
        providers: [DependentProviderA],
      })
      class ModuleB {}

      @BytiumResource({
        modules: [ModuleA, ModuleB],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, ModuleA);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, ModuleB);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });
  });
});
