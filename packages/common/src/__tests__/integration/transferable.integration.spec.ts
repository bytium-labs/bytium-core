import { BytiumResource, BytiumResourceModule, Inject, Injectable, Transferable } from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType } from "@shared";

describe("@Transferable", () => {
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

  it("should hide a constructor-injected @Injectable dependency from Object.keys on a @Transferable provider", async () => {
    @Injectable()
    class DependencyProviderA {}

    @Injectable()
    @Transferable()
    class DependentProviderA {
      constructor(public dependencyProviderA: DependencyProviderA) {}
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

    expect(dependentProviderAInstance!.dependencyProviderA).toBeInstanceOf(DependencyProviderA);

    const ownKeys = Object.keys(dependentProviderAInstance!);
    const ownDescriptor = Object.getOwnPropertyDescriptor(dependentProviderAInstance!, "dependencyProviderA");

    expect(ownKeys).not.toContain("dependencyProviderA");
    expect(ownDescriptor?.enumerable).toBe(false);
  });

  it("should expose __ownerResourceName as an enumerable own property for developer-code reads (plugins, debug, origin tracing)", async () => {
    @Injectable()
    @Transferable()
    class DependentProviderA {}

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

    const dependentProviderAInstance = getInstance<DependentProviderA & { __ownerResourceName: string }>(
      DependentProviderA,
      TestModule,
    );

    expect(Object.keys(dependentProviderAInstance!)).toContain("__ownerResourceName");
    expect(dependentProviderAInstance!.__ownerResourceName).toBe("test-resource");
  });

  it("should hide a property-injected dependency from Object.keys on a @Transferable provider", async () => {
    @Injectable()
    class DependencyProviderA {}

    @Injectable()
    @Transferable()
    class DependentProviderA {
      @Inject(DependencyProviderA)
      public dependencyProviderA: DependencyProviderA;
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

    expect(dependentProviderAInstance!.dependencyProviderA).toBeInstanceOf(DependencyProviderA);

    const ownKeys = Object.keys(dependentProviderAInstance!);
    const ownDescriptor = Object.getOwnPropertyDescriptor(dependentProviderAInstance!, "dependencyProviderA");

    expect(ownKeys).not.toContain("dependencyProviderA");
    expect(ownDescriptor?.enumerable).toBe(false);
  });
});
