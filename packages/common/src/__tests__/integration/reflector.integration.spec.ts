import "reflect-metadata";
import { BytiumResource, BytiumResourceModule, Injectable, Reflector } from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType } from "@shared";

describe("Reflector", () => {
  const SCALAR_METADATA_KEY = Symbol("reflector-test:scalar");
  const ARRAY_METADATA_KEY = Symbol("reflector-test:array");
  const OBJECT_METADATA_KEY = Symbol("reflector-test:object");
  const ScalarMetadata = (value: string): ClassDecorator & MethodDecorator =>
    ((target: object, propertyKey?: string | symbol) => {
      if (propertyKey !== undefined) {
        Reflect.defineMetadata(SCALAR_METADATA_KEY, value, target, propertyKey);
      } else {
        Reflect.defineMetadata(SCALAR_METADATA_KEY, value, target);
      }
    }) as ClassDecorator & MethodDecorator;
  const ArrayMetadata = (values: string[]): ClassDecorator =>
    ((target: object) => {
      Reflect.defineMetadata(ARRAY_METADATA_KEY, values, target);
    }) as ClassDecorator;
  const ObjectMetadata = (value: Record<string, unknown>): ClassDecorator =>
    ((target: object) => {
      Reflect.defineMetadata(OBJECT_METADATA_KEY, value, target);
    }) as ClassDecorator;
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
      constructor(public reflector: Reflector) {}
    }

    @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

    expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
    expect(dependentProviderAInstance?.reflector).toBeInstanceOf(Reflector);
  });

  describe("get", () => {
    it("should read class-level metadata defined on the target", async () => {
      @ScalarMetadata("class-value")
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public reflector: Reflector) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const readValue = dependentProviderAInstance?.reflector.get<string>(SCALAR_METADATA_KEY, DependencyProviderA);

      expect(readValue).toBe("class-value");
    });

    it("should read method-level metadata when a propertyKey is provided", async () => {
      class DependencyProviderA {
        @ScalarMetadata("method-value")
        someMethod() {}
      }

      @Injectable()
      class DependentProviderA {
        constructor(public reflector: Reflector) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const readValue = dependentProviderAInstance?.reflector.get<string>(
        SCALAR_METADATA_KEY,
        DependencyProviderA.prototype,
        "someMethod",
      );

      expect(readValue).toBe("method-value");
    });

    it("should return undefined when no metadata is defined for the requested key", async () => {
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public reflector: Reflector) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const readValue = dependentProviderAInstance?.reflector.get<string>(SCALAR_METADATA_KEY, DependencyProviderA);

      expect(readValue).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("should return an array of metadata values aligned with the targets array", async () => {
      @ScalarMetadata("from-A")
      class DependencyProviderA {}

      @ScalarMetadata("from-B")
      class DependencyProviderB {}

      @Injectable()
      class DependentProviderA {
        constructor(public reflector: Reflector) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const readValues = dependentProviderAInstance?.reflector.getAll<string>(SCALAR_METADATA_KEY, [
        DependencyProviderA,
        DependencyProviderB,
      ]);

      expect(readValues).toEqual(["from-A", "from-B"]);
    });

    it("should produce undefined slots for targets without the requested metadata", async () => {
      @ScalarMetadata("from-A")
      class DependencyProviderA {}

      class DependencyProviderB {}

      @Injectable()
      class DependentProviderA {
        constructor(public reflector: Reflector) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const readValues = dependentProviderAInstance?.reflector.getAll<string>(SCALAR_METADATA_KEY, [
        DependencyProviderA,
        DependencyProviderB,
      ]);

      expect(readValues).toEqual(["from-A", undefined]);
    });
  });

  describe("getAllAndMerge", () => {
    it("should concatenate array metadata from multiple targets in order", async () => {
      @ArrayMetadata(["a", "b"])
      class DependencyProviderA {}

      @ArrayMetadata(["c", "d"])
      class DependencyProviderB {}

      @Injectable()
      class DependentProviderA {
        constructor(public reflector: Reflector) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const merged = dependentProviderAInstance?.reflector.getAllAndMerge<string[]>(ARRAY_METADATA_KEY, [
        DependencyProviderA,
        DependencyProviderB,
      ]);

      expect(merged).toEqual(["a", "b", "c", "d"]);
    });

    it("should shallow-merge plain object metadata from multiple targets - later targets override earlier keys", async () => {
      @ObjectMetadata({ shared: "from-A", onlyOnA: 1 })
      class DependencyProviderA {}

      @ObjectMetadata({ shared: "from-B", onlyOnB: 2 })
      class DependencyProviderB {}

      @Injectable()
      class DependentProviderA {
        constructor(public reflector: Reflector) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const merged = dependentProviderAInstance?.reflector.getAllAndMerge<Record<string, unknown>>(
        OBJECT_METADATA_KEY,
        [DependencyProviderA, DependencyProviderB],
      );

      expect(merged).toEqual({ shared: "from-B", onlyOnA: 1, onlyOnB: 2 });
    });

    it("should skip targets that have no metadata for the requested key", async () => {
      @ArrayMetadata(["a"])
      class DependencyProviderA {}

      class DependencyProviderB {}

      @ArrayMetadata(["c"])
      class DependencyProviderC {}

      @Injectable()
      class DependentProviderA {
        constructor(public reflector: Reflector) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const merged = dependentProviderAInstance?.reflector.getAllAndMerge<string[]>(ARRAY_METADATA_KEY, [
        DependencyProviderA,
        DependencyProviderB,
        DependencyProviderC,
      ]);

      expect(merged).toEqual(["a", "c"]);
    });
  });

  describe("getAllAndOverride", () => {
    it("should return the first non-undefined metadata value in target order", async () => {
      class DependencyProviderA {}

      @ScalarMetadata("from-B")
      class DependencyProviderB {}

      @ScalarMetadata("from-C")
      class DependencyProviderC {}

      @Injectable()
      class DependentProviderA {
        constructor(public reflector: Reflector) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const override = dependentProviderAInstance?.reflector.getAllAndOverride<string>(SCALAR_METADATA_KEY, [
        DependencyProviderA,
        DependencyProviderB,
        DependencyProviderC,
      ]);

      expect(override).toBe("from-B");
    });

    it("should return undefined when no target has the requested metadata", async () => {
      class DependencyProviderA {}

      class DependencyProviderB {}

      @Injectable()
      class DependentProviderA {
        constructor(public reflector: Reflector) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const override = dependentProviderAInstance?.reflector.getAllAndOverride<string>(SCALAR_METADATA_KEY, [
        DependencyProviderA,
        DependencyProviderB,
      ]);

      expect(override).toBeUndefined();
    });
  });
});
