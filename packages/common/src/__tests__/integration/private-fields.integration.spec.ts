import { BytiumResource, BytiumResourceModule, forwardRef, Inject, Injectable } from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType } from "@shared";

describe("Providers with native private fields", () => {
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

  it("should preserve access to a native private field on a Provider with no dependencies", async () => {
    @Injectable()
    class DependencyProviderA {
      #counter = 0;

      increment(): number {
        return ++this.#counter;
      }
    }

    @BytiumResourceModule({
      name: "testModule",
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
    expect(dependencyProviderAInstance!.increment()).toBe(1);
    expect(dependencyProviderAInstance!.increment()).toBe(2);
  });

  it("should preserve access to a native private field on a Dependent Provider that owns the field", async () => {
    @Injectable()
    class DependencyProviderA {}

    @Injectable()
    class DependentProviderA {
      #counter = 0;

      constructor(public dependencyProviderA: DependencyProviderA) {}

      increment(): number {
        return ++this.#counter;
      }
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

    expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
    expect(dependentProviderAInstance!.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
    expect(dependentProviderAInstance!.increment()).toBe(1);
    expect(dependentProviderAInstance!.increment()).toBe(2);
  });

  it("should preserve access to a native private field on a Module class with no constructor params", async () => {
    @BytiumResourceModule({
      name: "testModule",
      providers: [],
    })
    class TestModule {
      #counter = 0;

      increment(): number {
        return ++this.#counter;
      }
    }

    @BytiumResource({
      modules: [TestModule],
    })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const testModuleNode = dependencyGraph.findModuleNode(TestModule)!;
    const testModuleInstance = testModuleNode.instances[0].instance as TestModule;

    expect(testModuleInstance).toBeInstanceOf(TestModule);
    expect(testModuleInstance.increment()).toBe(1);
    expect(testModuleInstance.increment()).toBe(2);
  });

  it("should preserve access to a native private field on a useClass custom provider target", async () => {
    @Injectable()
    class UseClassTarget {
      #counter = 0;

      increment(): number {
        return ++this.#counter;
      }
    }

    @Injectable()
    class DependentProviderA {
      constructor(@Inject("USE_CLASS_VALUE") public useClassValue: UseClassTarget) {}
    }

    @BytiumResourceModule({
      name: "testModule",
      providers: [UseClassTarget, { provide: "USE_CLASS_VALUE", useClass: UseClassTarget }, DependentProviderA],
    })
    class TestModule {}

    @BytiumResource({
      modules: [TestModule],
    })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

    expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
    expect(dependentProviderAInstance!.useClassValue).toBeInstanceOf(UseClassTarget);
    expect(dependentProviderAInstance!.useClassValue.increment()).toBe(1);
    expect(dependentProviderAInstance!.useClassValue.increment()).toBe(2);
  });

  it("should preserve access to a native private field on a Provider in a forwardRef cycle", async () => {
    @Injectable()
    class DependencyProviderA {
      #counter = 0;

      constructor(@Inject(forwardRef(() => DependencyProviderB)) public dependencyProviderB: any) {}

      increment(): number {
        return ++this.#counter;
      }
    }

    @Injectable()
    class DependencyProviderB {
      constructor(@Inject(forwardRef(() => DependencyProviderA)) public dependencyProviderA: any) {}
    }

    @BytiumResourceModule({
      name: "testModule",
      providers: [DependencyProviderA, DependencyProviderB],
    })
    class TestModule {}

    @BytiumResource({
      modules: [TestModule],
    })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);

    expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
    expect(dependencyProviderAInstance!.dependencyProviderB).toBeInstanceOf(DependencyProviderB);
    expect(dependencyProviderAInstance!.increment()).toBe(1);
    expect(dependencyProviderAInstance!.increment()).toBe(2);
  });
});
