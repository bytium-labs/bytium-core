import "reflect-metadata";
import { BytiumProviderScopeEnum, BytiumResource, BytiumResourceModule, Inject, Injectable, ModuleRef } from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { ContextualProviderInjectionException } from "@core/exceptions/contextual-provider-injection.exception";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType } from "@shared";

describe("Contextual scope", () => {
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

  it("should not instantiate a contextual-scoped provider eagerly", async () => {
    @Injectable({ scope: BytiumProviderScopeEnum.CONTEXTUAL })
    class ContextualProviderA {}

    @BytiumResourceModule({ name: "testModule", providers: [ContextualProviderA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const contextualProviderANode = dependencyGraph.getNode(ContextualProviderA);

    expect(contextualProviderANode?.scope).toBe(BytiumProviderScopeEnum.CONTEXTUAL);
    expect(contextualProviderANode?.instances).toHaveLength(0);
  });

  it("should reject injecting a contextual-scoped provider into an eager singleton", async () => {
    @Injectable({ scope: BytiumProviderScopeEnum.CONTEXTUAL })
    class ContextualProviderA {}

    @Injectable()
    class DependentProviderA {
      constructor(public contextualProviderA: ContextualProviderA) {}
    }

    @BytiumResourceModule({ name: "testModule", providers: [ContextualProviderA, DependentProviderA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    const thrown = await dependencyManager.resolve(TestResource).catch((error) => error);

    expect(thrown).toBeInstanceOf(ContextualProviderInjectionException);
    expect((thrown as Error).message).toContain("ContextualProviderA");
  });

  it("should reject a contextual-scoped provider injected into an eager singleton at validation time", () => {
    @Injectable({ scope: BytiumProviderScopeEnum.CONTEXTUAL })
    class ContextualProviderA {}

    @Injectable()
    class DependentProviderA {
      constructor(public contextualProviderA: ContextualProviderA) {}
    }

    @BytiumResourceModule({ name: "testModule", providers: [ContextualProviderA, DependentProviderA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    dependencyManager.scan(TestResource);
    dependencyManager.seedFrameworkProviders();

    let thrown: unknown;

    try {
      dependencyManager.validate();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ContextualProviderInjectionException);
    expect((thrown as Error).message).toContain("ContextualProviderA");
  });

  it("should resolve a contextual provider fresh per store, sharing it within a store and reusing singletons", async () => {
    @Injectable()
    class SingletonProviderA {}

    @Injectable({ scope: BytiumProviderScopeEnum.CONTEXTUAL })
    class ContextualProviderA {
      constructor(public singletonProviderA: SingletonProviderA) {}
    }

    @Injectable()
    class DependentProviderA {
      constructor(public moduleRef: ModuleRef) {}
    }

    @BytiumResourceModule({
      name: "testModule",
      providers: [SingletonProviderA, ContextualProviderA, DependentProviderA],
    })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
    const singletonProviderAInstance = getInstance<SingletonProviderA>(SingletonProviderA, TestModule);
    const storeOne = new Map<GraphTokenType, unknown>();
    const storeTwo = new Map<GraphTokenType, unknown>();
    const firstFromStoreOne = await dependentProviderAInstance!.moduleRef.resolveContextual<ContextualProviderA>(
      ContextualProviderA,
      storeOne,
    );
    const secondFromStoreOne = await dependentProviderAInstance!.moduleRef.resolveContextual<ContextualProviderA>(
      ContextualProviderA,
      storeOne,
    );
    const fromStoreTwo = await dependentProviderAInstance!.moduleRef.resolveContextual<ContextualProviderA>(
      ContextualProviderA,
      storeTwo,
    );

    expect(firstFromStoreOne).toBeInstanceOf(ContextualProviderA);
    expect(firstFromStoreOne.singletonProviderA).toBe(singletonProviderAInstance);

    expect(secondFromStoreOne).toBe(firstFromStoreOne);

    expect(fromStoreTwo).not.toBe(firstFromStoreOne);
    expect(fromStoreTwo.singletonProviderA).toBe(singletonProviderAInstance);
  });

  it("should inject a store-seeded context object into a contextual provider", async () => {
    const REQUEST_DATA = "REQUEST_DATA";

    @Injectable({ scope: BytiumProviderScopeEnum.CONTEXTUAL })
    class ContextualProviderA {
      constructor(@Inject(REQUEST_DATA) public requestData: { id: number }) {}
    }

    @Injectable()
    class DependentProviderA {
      constructor(public moduleRef: ModuleRef) {}
    }

    @BytiumResourceModule({ name: "testModule", providers: [ContextualProviderA, DependentProviderA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
    const store = new Map<GraphTokenType, unknown>([[REQUEST_DATA, { id: 7 }]]);
    const contextualProviderAInstance =
      await dependentProviderAInstance!.moduleRef.resolveContextual<ContextualProviderA>(ContextualProviderA, store);

    expect(contextualProviderAInstance.requestData).toEqual({ id: 7 });
  });
});
