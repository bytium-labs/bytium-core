import {
  BytiumProviderScopeEnum,
  BytiumResource,
  BytiumResourceModule,
  CircularFactoryPrimitiveException,
  ConcurrentResolveException,
  DependencyOutOfScopeException,
  DependencyUndefinedException,
  forwardRef,
  Inject,
  Injectable,
  InvalidInjectException,
  MixedMultiProviderException,
  ModuleRef,
  Optional,
  PossibleCircularDependencyException,
  WrongDependencyTypeException,
} from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType, INQUIRER } from "@shared";

describe("Providers resolution", () => {
  const simpleObjectValue = { message: "Hello, world!" };
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

  describe("class providers", () => {
    it("should resolve providers with no dependencies", async () => {
      @Injectable()
      class DependencyProviderA {}

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

      const dependencyProviderAInstance = getInstance(DependencyProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
    });

    it("should resolve providers with dependencies", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
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

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
    });

    it("should resolve providers with nested dependencies", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @Injectable()
      class NestedDependentProvider {
        constructor(public dependentProviderA: DependentProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA, DependentProviderA, NestedDependentProvider],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const nestedDependentProviderInstance = getInstance<NestedDependentProvider>(NestedDependentProvider, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);

      expect(nestedDependentProviderInstance).toBeInstanceOf(NestedDependentProvider);
      expect(nestedDependentProviderInstance?.dependentProviderA).toBeInstanceOf(DependentProviderA);
      expect(nestedDependentProviderInstance?.dependentProviderA).toBe(dependentProviderAInstance);
    });

    it("should reuse same instance for multiple dependencies", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA, DependentProviderA, DependentProviderB],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);

      expect(dependentProviderBInstance).toBeInstanceOf(DependentProviderB);
      expect(dependentProviderBInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should throw when dependency is missing", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(public _missingDependency: any) {}
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

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should throw when @Injectable is missing", async () => {
      class NonInjectableClass {}

      @BytiumResourceModule({
        name: "testModule",
        providers: [NonInjectableClass],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(WrongDependencyTypeException);
    });

    it("should throw when a provider's constructor takes a primitive type without @Inject", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(public someValue: number) {}
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

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow();
    });

    it("should treat the same provider class appearing twice in providers as a single instance", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA, DependencyProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderANode = dependencyGraph.getNode(DependencyProviderA);

      expect(dependencyProviderANode?.instances).toHaveLength(1);
    });

    it("should respect the @Inject decorator closest to the parameter when multiple are stacked", async () => {
      const CLOSER_TOKEN = "CLOSER";
      const FARTHER_TOKEN = "FARTHER";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(FARTHER_TOKEN) @Inject(CLOSER_TOKEN) public value: string) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          { provide: CLOSER_TOKEN, useValue: "closer" },
          { provide: FARTHER_TOKEN, useValue: "farther" },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.value).toBe("farther");
    });
  });

  describe("useValue providers", () => {
    it("should resolve primitive values", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@Inject("PRIMITIVE_VALUE") public primitiveValue: number) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "PRIMITIVE_VALUE",
            useValue: 42,
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const primitiveValue = getInstance<number>("PRIMITIVE_VALUE", TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(primitiveValue).toBe(42);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.primitiveValue).toBe(42);
    });

    it("should resolve object values", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@Inject("OBJECT_VALUE") public objectValue: { message: string }) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "OBJECT_VALUE",
            useValue: simpleObjectValue,
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const objectValue = getInstance<{ message: string }>("OBJECT_VALUE", TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(objectValue).toBe(simpleObjectValue);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.objectValue).toBe(simpleObjectValue);
    });

    it("should resolve null values", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@Inject("NULL_VALUE") public nullValue: null) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "NULL_VALUE",
            useValue: null,
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const nullValue = getInstance<null>("NULL_VALUE", TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(nullValue).toBeNull();

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.nullValue).toBeNull();
    });

    it("should resolve falsy useValue (0, false, empty string)", async () => {
      const ZERO_TOKEN = "ZERO";
      const FALSE_TOKEN = "FALSE";
      const EMPTY_TOKEN = "EMPTY";

      @Injectable()
      class DependentProviderA {
        constructor(
          @Inject(ZERO_TOKEN) public zeroValue: number,
          @Inject(FALSE_TOKEN) public falseValue: boolean,
          @Inject(EMPTY_TOKEN) public emptyValue: string,
        ) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          { provide: ZERO_TOKEN, useValue: 0 },
          { provide: FALSE_TOKEN, useValue: false },
          { provide: EMPTY_TOKEN, useValue: "" },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.zeroValue).toBe(0);
      expect(dependentProviderAInstance?.falseValue).toBe(false);
      expect(dependentProviderAInstance?.emptyValue).toBe("");
    });

    it("should reuse same primitive value for multiple dependencies", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@Inject("PRIMITIVE_VALUE") public primitiveValue: number) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(@Inject("PRIMITIVE_VALUE") public primitiveValue: number) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "PRIMITIVE_VALUE",
            useValue: 42,
          },
          DependentProviderA,
          DependentProviderB,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const primitiveValue = getInstance<number>("PRIMITIVE_VALUE", TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(primitiveValue).toBe(42);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.primitiveValue).toBe(42);

      expect(dependentProviderBInstance).toBeInstanceOf(DependentProviderB);
      expect(dependentProviderBInstance?.primitiveValue).toBe(42);
    });

    it("should reuse same object value for multiple dependencies", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@Inject("OBJECT_VALUE") public objectValue: { message: string }) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(@Inject("OBJECT_VALUE") public objectValue: { message: string }) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "OBJECT_VALUE",
            useValue: simpleObjectValue,
          },
          DependentProviderA,
          DependentProviderB,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const objectValue = getInstance<{ message: string }>("OBJECT_VALUE", TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(objectValue).toBe(simpleObjectValue);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.objectValue).toBe(simpleObjectValue);

      expect(dependentProviderBInstance).toBeInstanceOf(DependentProviderB);
      expect(dependentProviderBInstance?.objectValue).toBe(simpleObjectValue);
    });

    it("should throw when value token is missing", async () => {
      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: undefined as unknown as ConstructorType,
            useValue: 42,
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });
  });

  describe("useFactory providers", () => {
    it("should resolve factory values with no dependencies", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@Inject("FACTORY_VALUE") public factoryValue: number) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "FACTORY_VALUE",
            useFactory: () => 42,
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const factoryValue = getInstance<number>("FACTORY_VALUE", TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(factoryValue).toBe(42);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.factoryValue).toBe(42);
    });

    it("should resolve factory values with dependencies", async () => {
      @Injectable()
      class DependencyProviderA {
        getValue(): number {
          return 42;
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("FACTORY_VALUE") public factoryValue: number) {}

        getValue(): number {
          return this.factoryValue;
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          DependencyProviderA,
          {
            provide: "FACTORY_VALUE",
            useFactory: (dependencyProviderA: DependencyProviderA) => dependencyProviderA.getValue(),
            inject: [DependencyProviderA],
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const factoryValue = getInstance<number>("FACTORY_VALUE", TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.getValue()).toBe(42);

      expect(factoryValue).toBe(42);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.factoryValue).toBe(42);
    });

    it("should reuse same factory value for multiple dependencies", async () => {
      @Injectable()
      class DependencyProviderA {
        getValue(): { message: string } {
          return simpleObjectValue;
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("FACTORY_OBJECT_VALUE") public factoryObjectValue: { message: string }) {}

        getValue(): { message: string } {
          return this.factoryObjectValue;
        }
      }

      @Injectable()
      class DependentProviderB {
        constructor(@Inject("FACTORY_OBJECT_VALUE") public factoryObjectValue: { message: string }) {}

        getValue(): { message: string } {
          return this.factoryObjectValue;
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          DependencyProviderA,
          {
            provide: "FACTORY_OBJECT_VALUE",
            useFactory: (dependencyProviderA: DependencyProviderA) => dependencyProviderA.getValue(),
            inject: [DependencyProviderA],
          },
          DependentProviderA,
          DependentProviderB,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const factoryObjectValue = getInstance<{ message: string }>("FACTORY_OBJECT_VALUE", TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.getValue()).toBe(simpleObjectValue);

      expect(factoryObjectValue).toBe(simpleObjectValue);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.factoryObjectValue).toBe(simpleObjectValue);

      expect(dependentProviderBInstance).toBeInstanceOf(DependentProviderB);
      expect(dependentProviderBInstance?.factoryObjectValue).toBe(simpleObjectValue);
    });

    it("should throw when factory token is missing", async () => {
      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            useFactory: () => 42,
          } as any,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should throw when factory is missing", async () => {
      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "INVALID_FACTORY",
          } as any,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should throw when factory dependency is missing", async () => {
      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "FACTORY_VALUE",
            useFactory: (_missingDependency: any) => 42,
            inject: ["MISSING_DEPENDENCY"],
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should throw when factory dependency type is wrong", async () => {
      class NonInjectableClass {}

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          NonInjectableClass,
          {
            provide: "FACTORY_VALUE",
            useFactory: (_nonInjectableDependency: NonInjectableClass) => 42,
            inject: [NonInjectableClass],
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(WrongDependencyTypeException);
    });

    it("should throw when factory throws an error", async () => {
      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "FACTORY_VALUE",
            useFactory: () => {
              throw new Error("Factory error");
            },
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow();
    });

    it("should resolve a useFactory inject entry wrapped in forwardRef when the wrapped provider is registered later in the providers list", async () => {
      @Injectable()
      class DependencyProviderA {
        public readonly marker = "dependency-a";
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "FACTORY_VALUE",
            useFactory: (dependencyProviderA: DependencyProviderA) => `factory:${dependencyProviderA.marker}`,
            inject: [forwardRef(() => DependencyProviderA)],
          },
          DependencyProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const factoryValue = getInstance<string>("FACTORY_VALUE", TestModule);

      expect(factoryValue).toBe("factory:dependency-a");
    });

    it("should resolve a circular useFactory dependency via forwardRef when the factory returns an object - placeholder reference content patched in place", async () => {
      const CIRCULAR_TOKEN = "CIRCULAR_TOKEN";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(CIRCULAR_TOKEN) public circular: { value: string; provider: string }) {}
      }
      @Injectable()
      class DependentProviderB {
        constructor(@Inject(CIRCULAR_TOKEN) public circular: { value: string; provider: string }) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          DependentProviderA,
          DependentProviderB,
          {
            provide: CIRCULAR_TOKEN,
            useFactory: (dependentProviderA: DependentProviderA) => ({
              value: "resolved",
              provider: dependentProviderA.constructor.name,
            }),
            inject: [forwardRef(() => DependentProviderA)],
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependentProviderAInstance!.circular.value).toBe("resolved");
      expect(dependentProviderAInstance!.circular.provider).toBe("DependentProviderA");

      expect(dependentProviderBInstance!.circular.value).toBe("resolved");
      expect(dependentProviderBInstance!.circular.provider).toBe("DependentProviderA");
    });

    it("should throw CircularFactoryPrimitiveException when a circular useFactory via forwardRef returns a primitive (cannot patch captured reference)", async () => {
      const CIRCULAR_TOKEN = "CIRCULAR_TOKEN";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(CIRCULAR_TOKEN) public circular: string) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          DependentProviderA,
          {
            provide: CIRCULAR_TOKEN,
            useFactory: (dependentProviderA: DependentProviderA) => `circular:${dependentProviderA.constructor.name}`,
            inject: [forwardRef(() => DependentProviderA)],
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(CircularFactoryPrimitiveException);
    });

    it("should resolve a useFactory inject entry wrapped in forwardRef inside the { token, optional } shape", async () => {
      @Injectable()
      class DependencyProviderA {
        public readonly marker = "dependency-a";
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "FACTORY_VALUE",
            useFactory: (dependencyProviderA: DependencyProviderA) =>
              dependencyProviderA ? `factory:${dependencyProviderA.marker}` : "factory:undefined",
            inject: [{ token: forwardRef(() => DependencyProviderA), optional: true }],
          },
          DependencyProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const factoryValue = getInstance<string>("FACTORY_VALUE", TestModule);

      expect(factoryValue).toBe("factory:dependency-a");
    });

    it("should resolve a circular useFactory dependency via a forwardRef wrapped in the { token, optional } shape", async () => {
      const CIRCULAR_TOKEN = "CIRCULAR_TOKEN";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(CIRCULAR_TOKEN) public circular: { value: string; provider: string }) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          DependentProviderA,
          {
            provide: CIRCULAR_TOKEN,
            useFactory: (dependentProviderA?: DependentProviderA) => ({
              value: "resolved",
              provider: dependentProviderA ? dependentProviderA.constructor.name : "undefined",
            }),
            inject: [{ token: forwardRef(() => DependentProviderA), optional: true }],
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance!.circular.value).toBe("resolved");
      expect(dependentProviderAInstance!.circular.provider).toBe("DependentProviderA");
    });

    it("should propagate the rejection when an async useFactory returns a rejected Promise", async () => {
      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "FACTORY_VALUE",
            useFactory: async () => {
              throw new Error("Async factory rejection");
            },
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow("Async factory rejection");
    });

    it("should throw at validate time when a useFactory inject array contains null", async () => {
      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "FACTORY_VALUE",
            useFactory: () => "ok",
            inject: [null as unknown as string],
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(/inject\[0\]/);
    });

    it("should throw at validate time when a useFactory inject array contains undefined", async () => {
      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "FACTORY_VALUE",
            useFactory: () => "ok",
            inject: [undefined as unknown as string],
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(/inject\[0\]/);
    });

    it("should call useFactory once per dependent when scope is TRANSIENT", async () => {
      const factory = jest.fn(() => ({ marker: Symbol("fresh") }));

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("FACTORY_VALUE") public factoryValue: { marker: symbol }) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(@Inject("FACTORY_VALUE") public factoryValue: { marker: symbol }) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          { provide: "FACTORY_VALUE", useFactory: factory, scope: BytiumProviderScopeEnum.TRANSIENT },
          DependentProviderA,
          DependentProviderB,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(factory).toHaveBeenCalledTimes(2);

      expect(dependentProviderAInstance!.factoryValue).not.toBe(dependentProviderBInstance!.factoryValue);
    });

    it("should instantiate a custom singleton provider eagerly even when nothing injects it", async () => {
      const UNUSED_TOKEN = Symbol("UNUSED_TOKEN");
      const factory = jest.fn(() => 42);

      @BytiumResourceModule({
        name: "testModule",
        providers: [{ provide: UNUSED_TOKEN, useFactory: factory }],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const unusedProviderNode = dependencyGraph.getNode(UNUSED_TOKEN);

      expect(factory).toHaveBeenCalledTimes(1);

      expect(unusedProviderNode?.instances).toHaveLength(1);
      expect(unusedProviderNode?.instances[0].instance).toBe(42);
    });
  });

  describe("useClass providers", () => {
    it("should resolve class providers with no dependencies", async () => {
      @Injectable()
      class DependencyProviderA {
        getValue(): number {
          return 42;
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("USE_CLASS_VALUE") public useClassValue: DependencyProviderA) {}

        getValue(): number {
          return this.useClassValue.getValue();
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "USE_CLASS_VALUE",
            useClass: DependencyProviderA,
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>("USE_CLASS_VALUE", TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.getValue()).toBe(42);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.useClassValue).toBeInstanceOf(DependencyProviderA);
      expect(dependentProviderAInstance?.useClassValue).toBe(dependencyProviderAInstance);
      expect(dependentProviderAInstance?.getValue()).toBe(42);
    });

    it("should resolve class providers with dependencies", async () => {
      @Injectable()
      class DependencyProviderA {
        getValue(): number {
          return 42;
        }
      }

      @Injectable()
      class DependencyProviderB {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        getValue(): number {
          return this.dependencyProviderA.getValue();
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("USE_CLASS_VALUE") public useClassValue: DependencyProviderB) {}

        getValue(): number {
          return this.useClassValue.getValue();
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          DependencyProviderA,
          {
            provide: "USE_CLASS_VALUE",
            useClass: DependencyProviderB,
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependencyProviderBInstance = getInstance<DependencyProviderB>("USE_CLASS_VALUE", TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.getValue()).toBe(42);

      expect(dependencyProviderBInstance).toBeInstanceOf(DependencyProviderB);
      expect(dependencyProviderBInstance?.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderBInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
      expect(dependencyProviderBInstance?.getValue()).toBe(42);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.useClassValue).toBeInstanceOf(DependencyProviderB);
      expect(dependentProviderAInstance?.useClassValue).toBe(dependencyProviderBInstance);
      expect(dependentProviderAInstance?.getValue()).toBe(42);
    });

    it("should reuse same class provider instance for multiple dependencies", async () => {
      @Injectable()
      class DependencyProviderA {
        getValue(): { message: string } {
          return simpleObjectValue;
        }
      }

      @Injectable()
      class DependencyProviderB {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        getValue(): { message: string } {
          return this.dependencyProviderA.getValue();
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("USE_CLASS_VALUE") public useClassValue: DependencyProviderB) {}

        getValue(): { message: string } {
          return this.useClassValue.getValue();
        }
      }

      @Injectable()
      class DependentProviderB {
        constructor(@Inject("USE_CLASS_VALUE") public useClassValue: DependencyProviderB) {}

        getValue(): { message: string } {
          return this.useClassValue.getValue();
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          DependencyProviderA,
          {
            provide: "USE_CLASS_VALUE",
            useClass: DependencyProviderB,
          },
          DependentProviderA,
          DependentProviderB,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependencyProviderBInstance = getInstance<DependencyProviderB>("USE_CLASS_VALUE", TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.getValue()).toBe(simpleObjectValue);

      expect(dependencyProviderBInstance).toBeInstanceOf(DependencyProviderB);
      expect(dependencyProviderBInstance?.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderBInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
      expect(dependencyProviderBInstance?.getValue()).toBe(simpleObjectValue);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.useClassValue).toBeInstanceOf(DependencyProviderB);
      expect(dependentProviderAInstance?.useClassValue).toBe(dependencyProviderBInstance);
      expect(dependentProviderAInstance?.getValue()).toBe(simpleObjectValue);

      expect(dependentProviderBInstance).toBeInstanceOf(DependentProviderB);
      expect(dependentProviderBInstance?.useClassValue).toBeInstanceOf(DependencyProviderB);
      expect(dependentProviderBInstance?.useClassValue).toBe(dependencyProviderBInstance);
      expect(dependentProviderBInstance?.getValue()).toBe(simpleObjectValue);
    });

    it("should throw when class provider token is missing", async () => {
      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            useClass: class {},
          } as any,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should throw when class provider is missing", async () => {
      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "MISSING_CLASS_PROVIDER",
          } as any,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should throw when class provider is not a class", async () => {
      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "INVALID_CLASS_PROVIDER",
            useClass: {},
          } as any,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(WrongDependencyTypeException);
    });

    it("should throw when class provider dependency is missing", async () => {
      @Injectable()
      class DependencyProviderA {
        constructor(public _missingDependency: any) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "USE_CLASS_VALUE",
            useClass: DependencyProviderA,
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should throw when class provider dependency type is wrong", async () => {
      class NonInjectableClass {}

      @Injectable()
      class DependencyProviderA {
        constructor(public _nonInjectableDependency: NonInjectableClass) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          NonInjectableClass,
          {
            provide: "USE_CLASS_VALUE",
            useClass: DependencyProviderA,
          },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(WrongDependencyTypeException);
    });

    it("should throw when trying to inject class provider directly", async () => {
      @Injectable()
      class DependencyProviderA {
        getValue(): number {
          return 42;
        }
      }

      @Injectable()
      class DependencyProviderB {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @Injectable()
      class DependentProviderA {
        constructor(public directProvider: DependencyProviderB) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          DependencyProviderA,
          {
            provide: "USE_CLASS_VALUE",
            useClass: DependencyProviderB,
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyOutOfScopeException);
    });

    it("should create a fresh useClass instance per dependent when scope is TRANSIENT", async () => {
      @Injectable()
      class DependencyProviderA {
        public readonly marker = Symbol("fresh");
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("USE_CLASS_VALUE") public dependencyProvider: DependencyProviderA) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(@Inject("USE_CLASS_VALUE") public dependencyProvider: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          DependencyProviderA,
          { provide: "USE_CLASS_VALUE", useClass: DependencyProviderA, scope: BytiumProviderScopeEnum.TRANSIENT },
          DependentProviderA,
          DependentProviderB,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependentProviderAInstance!.dependencyProvider).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderBInstance!.dependencyProvider).toBeInstanceOf(DependencyProviderA);
      expect(dependentProviderBInstance!.dependencyProvider).not.toBe(dependentProviderAInstance!.dependencyProvider);
    });

    it("should honor the useClass target's @Injectable({ scope: TRANSIENT }) when the custom provider config omits scope", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientReplacement {}

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("USE_CLASS_VALUE") public service: TransientReplacement) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(@Inject("USE_CLASS_VALUE") public service: TransientReplacement) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          { provide: "USE_CLASS_VALUE", useClass: TransientReplacement },
          DependentProviderA,
          DependentProviderB,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependentProviderAInstance!.service).toBeInstanceOf(TransientReplacement);

      expect(dependentProviderBInstance!.service).toBeInstanceOf(TransientReplacement);
      expect(dependentProviderBInstance!.service).not.toBe(dependentProviderAInstance!.service);
    });

    it("should let an explicit scope on the custom provider config override the useClass target's @Injectable scope", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientClass {}

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("USE_CLASS_VALUE") public service: TransientClass) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(@Inject("USE_CLASS_VALUE") public service: TransientClass) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: "USE_CLASS_VALUE",
            useClass: TransientClass,
            scope: BytiumProviderScopeEnum.SINGLETON,
          },
          DependentProviderA,
          DependentProviderB,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependentProviderBInstance!.service).toBe(dependentProviderAInstance!.service);
    });
  });

  describe("transient providers", () => {
    it("should create unique instance with no dependencies for each dependent", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProvider {}

      @Injectable()
      class DependentProviderA {
        constructor(public transientProvider: TransientProvider) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(public transientProvider: TransientProvider) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [TransientProvider, DependentProviderA, DependentProviderB],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.transientProvider).toBeInstanceOf(TransientProvider);

      expect(dependentProviderBInstance).toBeInstanceOf(DependentProviderB);
      expect(dependentProviderBInstance?.transientProvider).toBeInstanceOf(TransientProvider);

      expect(dependentProviderBInstance?.transientProvider).not.toBe(dependentProviderAInstance?.transientProvider);
    });

    it("should create unique instance with dependencies for each dependent", async () => {
      @Injectable()
      class DependencyProviderA {
        getValue(): { message: string } {
          return simpleObjectValue;
        }
      }

      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProvider {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        getValue(): { message: string } {
          return this.dependencyProviderA.getValue();
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public transientProvider: TransientProvider) {}

        getValue(): { message: string } {
          return this.transientProvider.getValue();
        }
      }

      @Injectable()
      class DependentProviderB {
        constructor(public transientProvider: TransientProvider) {}

        getValue(): { message: string } {
          return this.transientProvider.getValue();
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA, TransientProvider, DependentProviderA, DependentProviderB],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.getValue()).toBe(simpleObjectValue);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.transientProvider).toBeInstanceOf(TransientProvider);
      expect(dependentProviderAInstance?.transientProvider.getValue()).toBe(simpleObjectValue);
      expect(dependentProviderAInstance?.getValue()).toBe(simpleObjectValue);

      expect(dependentProviderBInstance).toBeInstanceOf(DependentProviderB);
      expect(dependentProviderBInstance?.transientProvider).toBeInstanceOf(TransientProvider);
      expect(dependentProviderBInstance?.transientProvider.getValue()).toBe(simpleObjectValue);
      expect(dependentProviderBInstance?.getValue()).toBe(simpleObjectValue);

      expect(dependentProviderBInstance?.transientProvider).not.toBe(dependentProviderAInstance?.transientProvider);
    });

    it("should create unique instance at each level of nested transient chain for each dependent", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {}

      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderB {
        constructor(public transientProviderA: TransientProviderA) {}
      }

      @Injectable()
      class DependentProviderA {
        constructor(public transientProviderB: TransientProviderB) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(public transientProviderB: TransientProviderB) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [TransientProviderA, TransientProviderB, DependentProviderA, DependentProviderB],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.transientProviderB).toBeInstanceOf(TransientProviderB);
      expect(dependentProviderAInstance?.transientProviderB.transientProviderA).toBeInstanceOf(TransientProviderA);

      expect(dependentProviderBInstance).toBeInstanceOf(DependentProviderB);
      expect(dependentProviderBInstance?.transientProviderB).toBeInstanceOf(TransientProviderB);
      expect(dependentProviderBInstance?.transientProviderB.transientProviderA).toBeInstanceOf(TransientProviderA);

      expect(dependentProviderAInstance?.transientProviderB).not.toBe(dependentProviderBInstance?.transientProviderB);
      expect(dependentProviderAInstance?.transientProviderB.transientProviderA).not.toBe(
        dependentProviderBInstance?.transientProviderB.transientProviderA,
      );
    });

    it("should NOT create instance in registry", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProvider {}

      @BytiumResourceModule({
        name: "testModule",
        providers: [TransientProvider],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const transientProvider = getInstance<TransientProvider>(TransientProvider, TestModule);

      expect(transientProvider).toBeUndefined();
    });
  });

  describe("property injection", () => {
    it("should inject a provider declared with @Inject on a class property after construction", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
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

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance!.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
    });

    it("should inject both constructor parameters and class properties on the same Provider", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependencyProviderB {}

      @Injectable()
      class DependentProviderA {
        @Inject(DependencyProviderB)
        public dependencyProviderB: DependencyProviderB;

        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA, DependencyProviderB, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance!.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
      expect(dependentProviderAInstance!.dependencyProviderB).toBeInstanceOf(DependencyProviderB);
    });

    it("should infer the token from the property type when @Inject is used without an argument", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        @Inject()
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
    });

    it("should inject a string-token custom provider via @Inject on a class property", async () => {
      const VALUE_TOKEN = "VALUE_TOKEN";

      @Injectable()
      class DependentProviderA {
        @Inject(VALUE_TOKEN)
        public injectedValue: number;
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [{ provide: VALUE_TOKEN, useValue: 42 }, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance!.injectedValue).toBe(42);
    });

    it("should throw InvalidInjectException when @Inject() on a property cannot determine a token", () => {
      class DependentProviderA {}

      const applyInjectWithoutToken = () => Inject()(DependentProviderA.prototype, "dependencyProviderA");

      expect(applyInjectWithoutToken).toThrow(InvalidInjectException);
    });

    it("should inject a forwardRef-ed provider via @Inject on a class property", async () => {
      @Injectable()
      class DependentProviderA {
        @Inject(forwardRef(() => DependencyProviderA))
        public dependencyProviderA: any;
      }

      @Injectable()
      class DependencyProviderA {}

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

      expect(dependentProviderAInstance?.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
    });
  });

  describe("INQUIRER injection", () => {
    it("should resolve INQUIRER for each transient provider dependencies", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProvider {
        constructor(@Inject(INQUIRER) public inquirer: any) {}
      }

      @Injectable()
      class DependentProviderA {
        constructor(public transientProvider: TransientProvider) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(public transientProvider: TransientProvider) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [TransientProvider, DependentProviderA, DependentProviderB],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.transientProvider).toBeInstanceOf(TransientProvider);
      expect(dependentProviderAInstance?.transientProvider.inquirer).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.transientProvider.inquirer).toBe(dependentProviderAInstance);

      expect(dependentProviderBInstance).toBeInstanceOf(DependentProviderB);
      expect(dependentProviderBInstance?.transientProvider).toBeInstanceOf(TransientProvider);
      expect(dependentProviderBInstance?.transientProvider.inquirer).toBeInstanceOf(DependentProviderB);
      expect(dependentProviderBInstance?.transientProvider.inquirer).toBe(dependentProviderBInstance);
    });

    it("should resolve INQUIRER as useClass target instance for transient dependency", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProvider {
        constructor(@Inject(INQUIRER) public inquirer: any) {}
      }

      @Injectable()
      class CustomInquirerProvider {
        constructor(public transientProvider: TransientProvider) {}
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("SERVICE_TOKEN") public customInquirerProvider: CustomInquirerProvider) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          TransientProvider,
          {
            provide: "SERVICE_TOKEN",
            useClass: CustomInquirerProvider,
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.customInquirerProvider).toBeInstanceOf(CustomInquirerProvider);
      expect(dependentProviderAInstance?.customInquirerProvider.transientProvider).toBeInstanceOf(TransientProvider);
      expect(dependentProviderAInstance?.customInquirerProvider.transientProvider.inquirer).toBeInstanceOf(
        CustomInquirerProvider,
      );
      expect(dependentProviderAInstance?.customInquirerProvider.transientProvider.inquirer).toBe(
        dependentProviderAInstance?.customInquirerProvider,
      );
    });

    it("should resolve INQUIRER as factory result for transient dependency", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProvider {
        constructor(@Inject(INQUIRER) public inquirer: any) {}
      }

      @Injectable()
      class CustomInquirerProvider {
        constructor(public transientProvider: TransientProvider) {}
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("SERVICE_TOKEN") public customInquirerProvider: CustomInquirerProvider) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          TransientProvider,
          {
            provide: "SERVICE_TOKEN",
            useFactory: (transientProvider: TransientProvider) => new CustomInquirerProvider(transientProvider),
            inject: [TransientProvider],
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.customInquirerProvider).toBeInstanceOf(CustomInquirerProvider);
      expect(dependentProviderAInstance?.customInquirerProvider.transientProvider).toBeInstanceOf(TransientProvider);
      expect(dependentProviderAInstance?.customInquirerProvider.transientProvider.inquirer).toBeInstanceOf(
        CustomInquirerProvider,
      );
      expect(dependentProviderAInstance?.customInquirerProvider.transientProvider.inquirer).toBe(
        dependentProviderAInstance?.customInquirerProvider,
      );
    });

    it("should resolve INQUIRER as direct parent in nested transient chain", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        constructor(@Inject(INQUIRER) public inquirer: any) {}
      }

      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderB {
        constructor(
          @Inject(INQUIRER) public inquirer: any,
          public transientProviderA: TransientProviderA,
        ) {}
      }

      @Injectable()
      class DependentProviderA {
        constructor(public transientProviderB: TransientProviderB) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [TransientProviderA, TransientProviderB, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.transientProviderB).toBeInstanceOf(TransientProviderB);
      expect(dependentProviderAInstance?.transientProviderB.inquirer).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.transientProviderB.inquirer).toBe(dependentProviderAInstance);
      expect(dependentProviderAInstance?.transientProviderB.transientProviderA).toBeInstanceOf(TransientProviderA);
      expect(dependentProviderAInstance?.transientProviderB.transientProviderA.inquirer).toBeInstanceOf(
        TransientProviderB,
      );
      expect(dependentProviderAInstance?.transientProviderB.transientProviderA.inquirer).toBe(
        dependentProviderAInstance?.transientProviderB,
      );
    });

    it("should resolve INQUIRER as direct parent at every level of a three-level nested transient chain", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        constructor(@Inject(INQUIRER) public inquirer: any) {}
      }

      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderB {
        constructor(
          @Inject(INQUIRER) public inquirer: any,
          public transientProviderA: TransientProviderA,
        ) {}
      }

      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderC {
        constructor(
          @Inject(INQUIRER) public inquirer: any,
          public transientProviderB: TransientProviderB,
        ) {}
      }

      @Injectable()
      class DependentProviderA {
        constructor(public transientProviderC: TransientProviderC) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [TransientProviderA, TransientProviderB, TransientProviderC, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance!.transientProviderC).toBeInstanceOf(TransientProviderC);
      expect(dependentProviderAInstance!.transientProviderC.inquirer).toBe(dependentProviderAInstance);
      expect(dependentProviderAInstance!.transientProviderC.transientProviderB).toBeInstanceOf(TransientProviderB);
      expect(dependentProviderAInstance!.transientProviderC.transientProviderB.inquirer).toBe(
        dependentProviderAInstance!.transientProviderC,
      );
      expect(dependentProviderAInstance!.transientProviderC.transientProviderB.transientProviderA).toBeInstanceOf(
        TransientProviderA,
      );
      expect(dependentProviderAInstance!.transientProviderC.transientProviderB.transientProviderA.inquirer).toBe(
        dependentProviderAInstance!.transientProviderC.transientProviderB,
      );
    });

    it("should NOT resolve INQUIRER for non-transient provider dependencies", async () => {
      @Injectable()
      class DependencyProviderA {
        constructor(@Inject(INQUIRER) public inquirer: any) {}
      }

      @Injectable()
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

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA.inquirer).toBeNull();
    });
  });

  describe("circular dependencies", () => {
    it("should resolve circular dependencies with forwardRef", async () => {
      @Injectable()
      class DependencyProviderA {
        constructor(@Inject(forwardRef(() => DependencyProviderB)) public dependencyProviderB: any) {}

        getValue(): { message: string } {
          return { message: "Hello from DependencyProviderA" };
        }

        getDependencyProviderBValue(): { message: string } {
          return this.dependencyProviderB.getValue();
        }
      }

      @Injectable()
      class DependencyProviderB {
        constructor(@Inject(forwardRef(() => DependencyProviderA)) public dependencyProviderA: any) {}

        getValue(): { message: string } {
          return { message: "Hello from DependencyProviderB" };
        }

        getDependencyProviderAValue(): { message: string } {
          return this.dependencyProviderA.getValue();
        }
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
      const dependencyProviderBInstance = getInstance<DependencyProviderB>(DependencyProviderB, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.dependencyProviderB).toBe(dependencyProviderBInstance);
      expect(dependencyProviderAInstance?.getValue()).toEqual({ message: "Hello from DependencyProviderA" });
      expect(dependencyProviderAInstance?.getDependencyProviderBValue()).toEqual({
        message: "Hello from DependencyProviderB",
      });

      expect(dependencyProviderBInstance).toBeInstanceOf(DependencyProviderB);
      expect(dependencyProviderBInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
      expect(dependencyProviderBInstance?.getValue()).toEqual({ message: "Hello from DependencyProviderB" });
      expect(dependencyProviderBInstance?.getDependencyProviderAValue()).toEqual({
        message: "Hello from DependencyProviderA",
      });
    });

    it("should resolve deeply nested circular dependencies with forwardRef", async () => {
      @Injectable()
      class DependencyProviderA {
        constructor(@Inject(forwardRef(() => DependencyProviderC)) public dependencyProviderC: any) {}

        getValue(): { message: string } {
          return { message: "Hello from DependencyProviderA" };
        }

        getDependencyProviderCValue(): { message: string } {
          return this.dependencyProviderC.getValue();
        }
      }

      @Injectable()
      class DependencyProviderB {
        constructor(@Inject(forwardRef(() => DependencyProviderA)) public dependencyProviderA: any) {}

        getValue(): { message: string } {
          return { message: "Hello from DependencyProviderB" };
        }

        getDependencyProviderAValue(): { message: string } {
          return this.dependencyProviderA.getValue();
        }
      }

      @Injectable()
      class DependencyProviderC {
        constructor(@Inject(forwardRef(() => DependencyProviderB)) public dependencyProviderB: any) {}

        getValue(): { message: string } {
          return { message: "Hello from DependencyProviderC" };
        }

        getDependencyProviderBValue(): { message: string } {
          return this.dependencyProviderB.getValue();
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA, DependencyProviderB, DependencyProviderC],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependencyProviderBInstance = getInstance<DependencyProviderB>(DependencyProviderB, TestModule);
      const dependencyProviderCInstance = getInstance<DependencyProviderC>(DependencyProviderC, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.dependencyProviderC).toBeInstanceOf(DependencyProviderC);
      expect(dependencyProviderAInstance?.dependencyProviderC).toBe(dependencyProviderCInstance);
      expect(dependencyProviderAInstance?.getValue()).toEqual({ message: "Hello from DependencyProviderA" });
      expect(dependencyProviderAInstance?.getDependencyProviderCValue()).toEqual({
        message: "Hello from DependencyProviderC",
      });

      expect(dependencyProviderBInstance).toBeInstanceOf(DependencyProviderB);
      expect(dependencyProviderBInstance?.dependencyProviderA).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderBInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
      expect(dependencyProviderBInstance?.getValue()).toEqual({ message: "Hello from DependencyProviderB" });
      expect(dependencyProviderBInstance?.getDependencyProviderAValue()).toEqual({
        message: "Hello from DependencyProviderA",
      });

      expect(dependencyProviderCInstance).toBeInstanceOf(DependencyProviderC);
      expect(dependencyProviderCInstance?.dependencyProviderB).toBeInstanceOf(DependencyProviderB);
      expect(dependencyProviderCInstance?.dependencyProviderB).toBe(dependencyProviderBInstance);
      expect(dependencyProviderCInstance?.getValue()).toEqual({ message: "Hello from DependencyProviderC" });
      expect(dependencyProviderCInstance?.getDependencyProviderBValue()).toEqual({
        message: "Hello from DependencyProviderB",
      });
    });

    it("should throw when forwardRef is missing in circular dependency", async () => {
      @Injectable()
      class DependencyProviderA {
        constructor(public dependencyProviderB: any) {}
      }

      @Injectable()
      class DependencyProviderB {
        constructor(public dependencyProviderA: any) {}
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

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should throw when only one side of circular dependency uses forwardRef", async () => {
      @Injectable()
      class DependencyProviderA {
        constructor(@Inject(forwardRef(() => DependencyProviderB)) public dependencyProviderB: any) {}
      }

      @Injectable()
      class DependencyProviderB {
        constructor(public dependencyProviderA: any) {}
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

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should throw when forwardRef points to non-existing provider", async () => {
      @Injectable()
      class DependencyProviderA {
        constructor(
          @Inject(forwardRef(() => undefined as unknown as ConstructorType)) public nonExistingProvider: any,
        ) {}
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

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should throw when transient providers have circular dependency with forwardRef", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        constructor(@Inject(forwardRef(() => TransientProviderB)) public transientProviderB: any) {}
      }

      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderB {
        constructor(@Inject(forwardRef(() => TransientProviderA)) public transientProviderA: any) {}
      }

      @Injectable()
      class DependentProviderA {
        constructor(public transientProviderA: TransientProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [TransientProviderA, TransientProviderB, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(PossibleCircularDependencyException);
    });
  });

  describe("special tokens", () => {
    it("should resolve symbol tokens", async () => {
      const SYMBOL_TOKEN = Symbol("SYMBOL_TOKEN");

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(SYMBOL_TOKEN) public symbolTokenValue: number) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: SYMBOL_TOKEN,
            useValue: 42,
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const symbolTokenValue = getInstance<number>(SYMBOL_TOKEN, TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(symbolTokenValue).toBe(42);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.symbolTokenValue).toBe(42);
    });

    it("should resolve string tokens with special characters", async () => {
      const SPECIAL_STRING_TOKEN = "SPECIAL_STRING_TOKEN!@#$%^&*()";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(SPECIAL_STRING_TOKEN) public specialStringTokenValue: number) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: SPECIAL_STRING_TOKEN,
            useValue: 42,
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const specialStringTokenValue = getInstance<number>(SPECIAL_STRING_TOKEN, TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(specialStringTokenValue).toBe(42);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.specialStringTokenValue).toBe(42);
    });

    it("should treat a user-defined string token whose value matches the historical INQUIRER literal as a regular token, not as the framework sentinel", async () => {
      const HISTORICAL_INQUIRER_LITERAL = "__bytium_inquirer__";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(HISTORICAL_INQUIRER_LITERAL) public injectedValue: unknown) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [{ provide: HISTORICAL_INQUIRER_LITERAL, useValue: "user value" }, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance!.injectedValue).toBe("user value");
    });

    it("should treat a user-defined string token whose value matches the historical MODULE_REF_OWNER literal as a regular token, not as the framework sentinel", async () => {
      const HISTORICAL_MODULE_REF_OWNER_LITERAL = "__bytium_module_ref_owner__";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(HISTORICAL_MODULE_REF_OWNER_LITERAL) public injectedValue: unknown) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [{ provide: HISTORICAL_MODULE_REF_OWNER_LITERAL, useValue: "user value" }, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance!.injectedValue).toBe("user value");
    });
  });

  describe("optional dependencies", () => {
    it("should inject undefined for an @Optional class dependency when its token is not registered", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(@Optional() public dependencyProviderA?: DependencyProviderA) {}
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

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBeUndefined();
    });

    it("should inject the provider normally when an @Optional class dependency is registered", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(@Optional() public dependencyProviderA?: DependencyProviderA) {}
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

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should inject undefined for an @Optional @Inject string-token dependency when no provider matches", async () => {
      const MAYBE_TOKEN = "MAYBE_TOKEN";

      @Injectable()
      class DependentProviderA {
        constructor(@Optional() @Inject(MAYBE_TOKEN) public maybeValue?: string) {}
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

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.maybeValue).toBeUndefined();
    });

    it("should inject the value normally when an @Optional @Inject string-token is registered with useValue", async () => {
      const CONFIG_TOKEN = "CONFIG_TOKEN";

      @Injectable()
      class DependentProviderA {
        constructor(@Optional() @Inject(CONFIG_TOKEN) public config?: { ready: boolean }) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [{ provide: CONFIG_TOKEN, useValue: { ready: true } }, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.config).toEqual({ ready: true });
    });

    it("should inject undefined for an @Optional property dependency when its token is not registered", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        @Inject() @Optional() public dependencyProviderA?: DependencyProviderA;
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

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBeUndefined();
    });

    it("should inject the provider normally when an @Optional property dependency is registered", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        @Inject() @Optional() public dependencyProviderA?: DependencyProviderA;
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

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should inject undefined into a useFactory when its inject lists a missing token as { optional: true }", async () => {
      const CONFIG_TOKEN = "CONFIG_TOKEN";
      const MISSING_TOKEN = "MISSING_TOKEN";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(CONFIG_TOKEN) public config: { resolved: unknown }) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          {
            provide: CONFIG_TOKEN,
            useFactory: (maybe?: unknown) => ({ resolved: maybe }),
            inject: [{ token: MISSING_TOKEN, optional: true }],
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.config).toEqual({ resolved: undefined });
    });

    it("should inject the resolved value into a useFactory when an optional inject token IS registered", async () => {
      const CONFIG_TOKEN = "CONFIG_TOKEN";
      const PRESENT_TOKEN = "PRESENT_TOKEN";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(CONFIG_TOKEN) public config: { resolved: unknown }) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          { provide: PRESENT_TOKEN, useValue: "present-value" },
          {
            provide: CONFIG_TOKEN,
            useFactory: (maybe?: unknown) => ({ resolved: maybe }),
            inject: [{ token: PRESENT_TOKEN, optional: true }],
          },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance?.config).toEqual({ resolved: "present-value" });
    });
  });

  describe("useExisting providers", () => {
    it("should resolve a useExisting alias to the same instance as the target provider", async () => {
      const ALIAS_TOKEN = "ALIAS_TOKEN";

      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(
          public dependencyProviderA: DependencyProviderA,
          @Inject(ALIAS_TOKEN) public aliasedDependencyProviderA: DependencyProviderA,
        ) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          DependencyProviderA,
          { provide: ALIAS_TOKEN, useExisting: DependencyProviderA },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
      expect(dependentProviderAInstance?.aliasedDependencyProviderA).toBe(dependencyProviderAInstance);
    });

    it("should fire onModuleInit only on the target provider, not on the useExisting alias", async () => {
      const ALIAS_TOKEN = "ALIAS_TOKEN";
      let initCount = 0;

      @Injectable()
      class DependencyProviderA {
        onModuleInit() {
          initCount++;
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(ALIAS_TOKEN) public aliasedDependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          DependencyProviderA,
          { provide: ALIAS_TOKEN, useExisting: DependencyProviderA },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      expect(initCount).toBe(1);
    });

    it("should throw when useExisting target is not registered", async () => {
      const ALIAS_TOKEN = "ALIAS_TOKEN";
      const MISSING_TARGET_TOKEN = "MISSING_TARGET";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(ALIAS_TOKEN) public aliasedValue: unknown) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [{ provide: ALIAS_TOKEN, useExisting: MISSING_TARGET_TOKEN }, DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(DependencyUndefinedException);
    });

    it("should snapshot the first resolved instance when useExisting aliases a TRANSIENT-scoped target", async () => {
      const ALIAS_TOKEN = "ALIAS_TOKEN";

      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        public readonly marker = Symbol("transient-marker");
      }

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(ALIAS_TOKEN) public aliasedTransient: TransientProviderA) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(@Inject(ALIAS_TOKEN) public aliasedTransient: TransientProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          TransientProviderA,
          { provide: ALIAS_TOKEN, useExisting: TransientProviderA },
          DependentProviderA,
          DependentProviderB,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependentProviderAInstance!.aliasedTransient).toBeInstanceOf(TransientProviderA);

      expect(dependentProviderBInstance!.aliasedTransient).toBeInstanceOf(TransientProviderA);
      expect(dependentProviderBInstance!.aliasedTransient).toBe(dependentProviderAInstance!.aliasedTransient);
    });
  });

  describe("concurrent resolve guard", () => {
    it("should throw ConcurrentResolveException when resolve() is invoked while a previous call is still in flight", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      const first = dependencyManager.resolve(TestResource);

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(ConcurrentResolveException);

      await first;
    });

    it("should let resolve() be called again after the previous call settled", async () => {
      @Injectable()
      class DependencyProviderA {}

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
      await dependencyManager.destroyAll();

      await expect(dependencyManager.resolve(TestResource)).resolves.toBeUndefined();
    });
  });

  describe("multi providers", () => {
    it("should inject an array of every provider registered under one token with multi: true", async () => {
      const PLUGIN = "PLUGIN";

      @Injectable()
      class PluginProviderA {}

      @Injectable()
      class PluginProviderB {}

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(PLUGIN) public plugins: object[]) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          { provide: PLUGIN, useClass: PluginProviderA, multi: true },
          { provide: PLUGIN, useClass: PluginProviderB, multi: true },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance?.plugins).toHaveLength(2);
      expect(dependentProviderAInstance?.plugins[0]).toBeInstanceOf(PluginProviderA);
      expect(dependentProviderAInstance?.plugins[1]).toBeInstanceOf(PluginProviderB);
    });

    it("should fire lifecycle hooks on every multi provider instance", async () => {
      const PLUGIN = "PLUGIN";
      const initialized: string[] = [];

      @Injectable()
      class PluginProviderA {
        onModuleInit() {
          initialized.push("PluginProviderA");
        }
      }

      @Injectable()
      class PluginProviderB {
        onModuleInit() {
          initialized.push("PluginProviderB");
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          { provide: PLUGIN, useClass: PluginProviderA, multi: true },
          { provide: PLUGIN, useClass: PluginProviderB, multi: true },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      expect(initialized).toHaveLength(2);
      expect(initialized).toContain("PluginProviderA");
      expect(initialized).toContain("PluginProviderB");
    });

    it("should aggregate useValue and useFactory multi providers in registration order", async () => {
      const CONFIG = "CONFIG";

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(CONFIG) public configs: unknown[]) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          { provide: CONFIG, useValue: "first", multi: true },
          { provide: CONFIG, useFactory: () => "second", multi: true },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance?.configs).toEqual(["first", "second"]);
    });

    it("should throw MixedMultiProviderException when a multi registration is followed by a non-multi one", async () => {
      const CONFIG = "CONFIG";

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          { provide: CONFIG, useValue: "multi", multi: true },
          { provide: CONFIG, useValue: "non-multi" },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(MixedMultiProviderException);
    });

    it("should resolve each multi provider's own constructor dependencies", async () => {
      const PLUGIN = "PLUGIN";

      @Injectable()
      class DependencyProviderA {
        public marker = "from-graph";
      }

      @Injectable()
      class PluginProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA, { provide: PLUGIN, useClass: PluginProviderA, multi: true }],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const plugins = getInstance<PluginProviderA[]>(PLUGIN, TestModule);

      expect(plugins).toHaveLength(1);
      expect(plugins?.[0].dependencyProviderA).toBeInstanceOf(DependencyProviderA);
    });

    it("should return the multi array from ModuleRef.get()", async () => {
      const PLUGIN = "PLUGIN";

      @Injectable()
      class PluginProviderA {}

      @Injectable()
      class PluginProviderB {}

      @Injectable()
      class DependentProviderA {
        constructor(public moduleRef: ModuleRef) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          { provide: PLUGIN, useClass: PluginProviderA, multi: true },
          { provide: PLUGIN, useClass: PluginProviderB, multi: true },
          DependentProviderA,
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const plugins = dependentProviderAInstance?.moduleRef.get<object[]>(PLUGIN);

      expect(plugins).toHaveLength(2);
      expect(plugins?.[0]).toBeInstanceOf(PluginProviderA);
      expect(plugins?.[1]).toBeInstanceOf(PluginProviderB);
    });

    it("should expose a multi token to an importing module when it is exported", async () => {
      const PLUGIN = "PLUGIN";

      @Injectable()
      class PluginProviderA {}

      @Injectable()
      class PluginProviderB {}

      @BytiumResourceModule({
        name: "pluginModule",
        providers: [
          { provide: PLUGIN, useClass: PluginProviderA, multi: true },
          { provide: PLUGIN, useClass: PluginProviderB, multi: true },
        ],
        exports: [PLUGIN],
      })
      class PluginModule {}

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(PLUGIN) public plugins: object[]) {}
      }

      @BytiumResourceModule({
        name: "dependentModule",
        imports: [PluginModule],
        providers: [DependentProviderA],
      })
      class DependentModule {}

      @BytiumResource({
        modules: [PluginModule, DependentModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, DependentModule);

      expect(dependentProviderAInstance?.plugins).toHaveLength(2);
      expect(dependentProviderAInstance?.plugins[0]).toBeInstanceOf(PluginProviderA);
      expect(dependentProviderAInstance?.plugins[1]).toBeInstanceOf(PluginProviderB);
    });

    it("should throw MixedMultiProviderException when a non-multi registration is followed by a multi one", async () => {
      const CONFIG = "CONFIG";

      @BytiumResourceModule({
        name: "testModule",
        providers: [
          { provide: CONFIG, useValue: "non-multi" },
          { provide: CONFIG, useValue: "multi", multi: true },
        ],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(MixedMultiProviderException);
    });
  });
});
