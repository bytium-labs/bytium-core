import "reflect-metadata";
import {
  BytiumResource,
  BytiumResourceModule,
  Controller,
  Global,
  Injectable,
  LazyModuleLoader,
  ModuleRef,
} from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { WrongDependencyTypeException } from "@core/exceptions/wrong-dependency-type.exception";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType } from "@shared";

describe("Lazy modules", () => {
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

  afterEach(async () => {
    await dependencyManager.destroyAll();
  });

  it("should not scan or instantiate a lazy module until it is loaded", async () => {
    @Injectable()
    class LazyProviderA {}

    @BytiumResourceModule({ name: "lazyModule", providers: [LazyProviderA] })
    class LazyModule {}

    @Injectable()
    class MainProviderA {
      constructor(public lazyModuleLoader: LazyModuleLoader) {}
    }

    @BytiumResourceModule({ name: "mainModule", providers: [MainProviderA] })
    class MainModule {}

    @BytiumResource({ modules: [MainModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    expect(dependencyGraph.getNode(LazyModule)).toBeUndefined();
    expect(dependencyGraph.getNode(LazyProviderA)).toBeUndefined();
  });

  it("should resolve a lazy module on demand and expose its providers through the returned ModuleRef", async () => {
    @Injectable()
    class LazyProviderA {}

    @BytiumResourceModule({ name: "lazyModule", providers: [LazyProviderA] })
    class LazyModule {}

    @Injectable()
    class MainProviderA {
      constructor(public lazyModuleLoader: LazyModuleLoader) {}
    }

    @BytiumResourceModule({ name: "mainModule", providers: [MainProviderA] })
    class MainModule {}

    @BytiumResource({ modules: [MainModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const mainProviderAInstance = getInstance<MainProviderA>(MainProviderA, MainModule);
    const lazyModuleRef = await mainProviderAInstance?.lazyModuleLoader.load(LazyModule);
    const lazyProviderAInstance = lazyModuleRef?.get<LazyProviderA>(LazyProviderA);

    expect(lazyModuleRef).toBeInstanceOf(ModuleRef);
    expect(lazyProviderAInstance).toBeInstanceOf(LazyProviderA);
  });

  it("should return the same provider instances when a lazy module is loaded twice", async () => {
    @Injectable()
    class LazyProviderA {}

    @BytiumResourceModule({ name: "lazyModule", providers: [LazyProviderA] })
    class LazyModule {}

    @Injectable()
    class MainProviderA {
      constructor(public lazyModuleLoader: LazyModuleLoader) {}
    }

    @BytiumResourceModule({ name: "mainModule", providers: [MainProviderA] })
    class MainModule {}

    @BytiumResource({ modules: [MainModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const mainProviderAInstance = getInstance<MainProviderA>(MainProviderA, MainModule);
    const firstLazyModuleRef = await mainProviderAInstance?.lazyModuleLoader.load(LazyModule);
    const secondLazyModuleRef = await mainProviderAInstance?.lazyModuleLoader.load(LazyModule);

    expect(firstLazyModuleRef).toBeInstanceOf(ModuleRef);
    expect(secondLazyModuleRef).toBe(firstLazyModuleRef);
    expect(secondLazyModuleRef?.get(LazyProviderA)).toBe(firstLazyModuleRef?.get(LazyProviderA));
  });

  it("should call onModuleInit on a lazy provider when its module is loaded", async () => {
    @Injectable()
    class LazyProviderA {
      public initialized = false;

      onModuleInit() {
        this.initialized = true;
      }
    }

    @BytiumResourceModule({ name: "lazyModule", providers: [LazyProviderA] })
    class LazyModule {}

    @Injectable()
    class MainProviderA {
      constructor(public lazyModuleLoader: LazyModuleLoader) {}
    }

    @BytiumResourceModule({ name: "mainModule", providers: [MainProviderA] })
    class MainModule {}

    @BytiumResource({ modules: [MainModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const mainProviderAInstance = getInstance<MainProviderA>(MainProviderA, MainModule);
    const lazyModuleRef = await mainProviderAInstance?.lazyModuleLoader.load(LazyModule);
    const lazyProviderAInstance = lazyModuleRef?.get<LazyProviderA>(LazyProviderA);

    expect(lazyProviderAInstance?.initialized).toBe(true);
  });

  it("should let a lazy provider inject a provider exported by an eagerly-resolved global module", async () => {
    @Injectable()
    class EagerProviderA {}

    @Global()
    @BytiumResourceModule({ name: "eagerModule", providers: [EagerProviderA], exports: [EagerProviderA] })
    class EagerModule {}

    @Injectable()
    class LazyProviderA {
      constructor(public eagerProviderA: EagerProviderA) {}
    }

    @BytiumResourceModule({ name: "lazyModule", providers: [LazyProviderA] })
    class LazyModule {}

    @Injectable()
    class MainProviderA {
      constructor(public lazyModuleLoader: LazyModuleLoader) {}
    }

    @BytiumResourceModule({ name: "mainModule", providers: [MainProviderA] })
    class MainModule {}

    @BytiumResource({ modules: [EagerModule, MainModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const mainProviderAInstance = getInstance<MainProviderA>(MainProviderA, MainModule);
    const eagerProviderAInstance = getInstance<EagerProviderA>(EagerProviderA, EagerModule);
    const lazyModuleRef = await mainProviderAInstance?.lazyModuleLoader.load(LazyModule);
    const lazyProviderAInstance = lazyModuleRef?.get<LazyProviderA>(LazyProviderA);

    expect(lazyProviderAInstance?.eagerProviderA).toBe(eagerProviderAInstance);
  });

  it("should reject loading a lazy module that contains a controller", async () => {
    @Controller()
    class LazyControllerA {}

    @BytiumResourceModule({ name: "lazyModule", controllers: [LazyControllerA] })
    class LazyModule {}

    @Injectable()
    class MainProviderA {
      constructor(public lazyModuleLoader: LazyModuleLoader) {}
    }

    @BytiumResourceModule({ name: "mainModule", providers: [MainProviderA] })
    class MainModule {}

    @BytiumResource({ modules: [MainModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const mainProviderAInstance = getInstance<MainProviderA>(MainProviderA, MainModule);
    const thrown = await mainProviderAInstance?.lazyModuleLoader.load(LazyModule).catch((error) => error);

    expect(thrown).toBeInstanceOf(WrongDependencyTypeException);
    expect((thrown as Error).message).toContain("cannot contain controllers");
  });
});
