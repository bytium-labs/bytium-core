import "reflect-metadata";
import { BytiumResource, BytiumResourceModule, Controller, DiscoveryService, Injectable } from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType } from "@shared";

describe("DiscoveryService", () => {
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

  it("should be injectable into any provider without explicit imports", async () => {
    @Injectable()
    class DependentProviderA {
      constructor(public discoveryService: DiscoveryService) {}
    }

    @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

    expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
    expect(dependentProviderAInstance?.discoveryService).toBeInstanceOf(DiscoveryService);
  });

  describe("getProviders", () => {
    it("should return the resolved instances of the resource's own providers", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public discoveryService: DiscoveryService) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependencyProviderA, DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const discoveredInstances = dependentProviderAInstance?.discoveryService
        .getProviders()
        .map((entry) => entry.instance);

      expect(discoveredInstances).toContain(dependencyProviderAInstance);
      expect(discoveredInstances).toContain(dependentProviderAInstance);
    });

    it("should expose the token and scope on each discovered provider", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public discoveryService: DiscoveryService) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependencyProviderA, DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const discoveredDependencyProviderA = dependentProviderAInstance?.discoveryService
        .getProviders()
        .find((entry) => entry.token === DependencyProviderA);

      expect(discoveredDependencyProviderA?.token).toBe(DependencyProviderA);
      expect(discoveredDependencyProviderA?.scope).toBe("SINGLETON");
    });
  });

  describe("getControllers", () => {
    it("should return controllers and exclude them from getProviders", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Controller()
      class ControllerA {}

      @Injectable()
      class DependentProviderA {
        constructor(public discoveryService: DiscoveryService) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA, DependentProviderA],
        controllers: [ControllerA],
      })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const discoveredControllerTokens = dependentProviderAInstance?.discoveryService
        .getControllers()
        .map((entry) => entry.token);
      const discoveredProviderTokens = dependentProviderAInstance?.discoveryService
        .getProviders()
        .map((entry) => entry.token);

      expect(discoveredControllerTokens).toContain(ControllerA);
      expect(discoveredControllerTokens).not.toContain(DependencyProviderA);

      expect(discoveredProviderTokens).not.toContain(ControllerA);
      expect(discoveredProviderTokens).toContain(DependencyProviderA);
    });
  });

  describe("getModules", () => {
    it("should return every registered module including the resource's own modules", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(public discoveryService: DiscoveryService) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const discoveredModuleClasses = dependentProviderAInstance?.discoveryService
        .getModules()
        .map((entry) => entry.moduleClass);

      expect(discoveredModuleClasses).toContain(TestModule);
    });
  });
});
