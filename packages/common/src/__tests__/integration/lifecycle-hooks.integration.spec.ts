import {
  BytiumProviderScopeEnum,
  BytiumResource,
  BytiumResourceDynamicModuleInterface,
  BytiumResourceModule,
  Controller,
  Global,
  Injectable,
} from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType } from "@shared";

describe("Lifecycle hooks", () => {
  let dependencyGraph: DependencyGraph;
  let dependencyManager: BytiumDependencyManager;
  const getInstance = <T>(token: GraphTokenType, module: ConstructorType): T | undefined => {
    const moduleNode = dependencyGraph.findModuleNode(module);

    return moduleNode ? (resolveVisibleInstance(dependencyGraph, token, moduleNode)?.instance as T) : undefined;
  };
  const getControllerInstance = <T>(token: ConstructorType): T | undefined =>
    dependencyGraph.getNode(token)?.instances.find((entry) => !entry.isAlias)?.instance as T | undefined;

  beforeEach(() => {
    dependencyGraph = new DependencyGraph();
    dependencyManager = new BytiumDependencyManager(dependencyGraph);
  });

  afterEach(() => {
    dependencyManager.destroyAll();
  });

  describe.each([
    {
      hookName: "onModuleInit" as const,
      trigger: async (m: BytiumDependencyManager, resource: ConstructorType) => {
        await m.resolve(resource);
      },
    },
    {
      hookName: "onResourceBootstrap" as const,
      trigger: async (m: BytiumDependencyManager, resource: ConstructorType) => {
        await m.resolve(resource);
        await m.bootstrapAll();
      },
    },
    {
      hookName: "onResourceStarted" as const,
      trigger: async (m: BytiumDependencyManager, resource: ConstructorType) => {
        await m.resolve(resource);
        await m.startAll();
      },
    },
  ])("$hookName", ({ hookName, trigger }) => {
    it(`should call ${hookName} on a singleton provider`, async () => {
      @Injectable()
      class DependencyProviderA {
        public called = false;

        [hookName]() {
          this.called = true;
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

      await trigger(dependencyManager, TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.called).toBe(true);
    });

    it(`should call ${hookName} on a Module class that implements the hook`, async () => {
      let called = false;

      @BytiumResourceModule({
        name: "testModule",
        providers: [],
      })
      class TestModule {
        [hookName]() {
          called = true;
        }
      }

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await trigger(dependencyManager, TestResource);

      expect(called).toBe(true);
    });

    it(`should call ${hookName} on a controller`, async () => {
      @Controller()
      class ControllerProviderA {
        public called = false;

        [hookName]() {
          this.called = true;
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        controllers: [ControllerProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await trigger(dependencyManager, TestResource);

      const controllerProviderAInstance = getControllerInstance<ControllerProviderA>(ControllerProviderA);

      expect(controllerProviderAInstance).toBeInstanceOf(ControllerProviderA);
      expect(controllerProviderAInstance?.called).toBe(true);
    });

    it(`should await async ${hookName} before continuing`, async () => {
      @Injectable()
      class DependencyProviderA {
        public called = false;

        async [hookName]() {
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.called = true;
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

      await trigger(dependencyManager, TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.called).toBe(true);
    });

    it(`should call ${hookName} on a transient provider for each created instance`, async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        public called = false;

        [hookName]() {
          this.called = true;
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public transientProviderA: TransientProviderA) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(public transientProviderA: TransientProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [TransientProviderA, DependentProviderA, DependentProviderB],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await trigger(dependencyManager, TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.transientProviderA).toBeInstanceOf(TransientProviderA);
      expect(dependentProviderAInstance?.transientProviderA.called).toBe(true);
      expect(dependentProviderAInstance?.transientProviderA).not.toBe(dependentProviderBInstance?.transientProviderA);

      expect(dependentProviderBInstance).toBeInstanceOf(DependentProviderB);
      expect(dependentProviderBInstance?.transientProviderA).toBeInstanceOf(TransientProviderA);
      expect(dependentProviderBInstance?.transientProviderA.called).toBe(true);
    });

    it(`should call transient ${hookName} before the dependent's ${hookName}`, async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        public called = false;

        [hookName]() {
          this.called = true;
        }
      }

      @Injectable()
      class DependentProviderA {
        public called = false;

        constructor(public transientProviderA: TransientProviderA) {}

        [hookName]() {
          if (!this.transientProviderA.called) {
            throw new Error(`Transient ${hookName} was not called before dependent's ${hookName}`);
          }

          this.called = true;
        }
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

      await trigger(dependencyManager, TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.called).toBe(true);
    });

    it(`should fire ${hookName} exactly once per transient instance (no double call)`, async () => {
      let callCount = 0;

      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        [hookName]() {
          callCount++;
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public transientProviderA: TransientProviderA) {}
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

      await trigger(dependencyManager, TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.transientProviderA).toBeInstanceOf(TransientProviderA);

      expect(callCount).toBe(1);
    });

    it(`should propagate when ${hookName} throws`, async () => {
      @Injectable()
      class DependencyProviderA {
        [hookName]() {
          throw new Error(`${hookName} boom`);
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

      await expect(trigger(dependencyManager, TestResource)).rejects.toThrow(`${hookName} boom`);
    });

    it(`should call ${hookName} on dependency providers before dependent providers`, async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        async [hookName]() {
          callLog.push("DependencyProviderA");
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        async [hookName]() {
          callLog.push("DependentProviderA");
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

      await trigger(dependencyManager, TestResource);

      expect(callLog).toEqual(["DependencyProviderA", "DependentProviderA"]);
    });

    it(`should call ${hookName} on imported module's providers before importing module's providers`, async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        async [hookName]() {
          callLog.push("DependencyProviderA");
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        async [hookName]() {
          callLog.push("DependentProviderA");
        }
      }

      @BytiumResourceModule({
        name: "importedModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ImportedModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [ImportedModule],
        providers: [DependentProviderA],
      })
      class ImportingModule {}

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await trigger(dependencyManager, TestResource);

      expect(callLog).toEqual(["DependencyProviderA", "DependentProviderA"]);
    });

    it(`should call ${hookName} on a provider declared in a dynamic module`, async () => {
      @Injectable()
      class DependencyProviderA {
        public called = false;

        async [hookName]() {
          this.called = true;
        }
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
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await trigger(dependencyManager, TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, DynamicTestModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.called).toBe(true);
    });

    it(`should call ${hookName} on a provider declared in a @Global module`, async () => {
      @Injectable()
      class DependencyProviderA {
        public called = false;

        async [hookName]() {
          this.called = true;
        }
      }

      @Global()
      @BytiumResourceModule({
        name: "globalModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class GlobalModule {}

      @BytiumResourceModule({ name: "testModule" })
      class TestModule {}

      @BytiumResource({
        modules: [GlobalModule, TestModule],
      })
      class TestResource {}

      await trigger(dependencyManager, TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, GlobalModule);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.called).toBe(true);
    });

    it(`should call ${hookName} on dependency providers before dependent providers`, async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        [hookName]() {
          callLog.push("DependencyProviderA");
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        [hookName]() {
          callLog.push("DependentProviderA");
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

      await trigger(dependencyManager, TestResource);

      expect(callLog).toEqual(["DependencyProviderA", "DependentProviderA"]);
    });

    it(`should call ${hookName} on imported module's providers before importing module's providers`, async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        [hookName]() {
          callLog.push("DependencyProviderA");
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        [hookName]() {
          callLog.push("DependentProviderA");
        }
      }

      @BytiumResourceModule({
        name: "importedModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ImportedModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [ImportedModule],
        providers: [DependentProviderA],
      })
      class ImportingModule {}

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await trigger(dependencyManager, TestResource);

      expect(callLog).toEqual(["DependencyProviderA", "DependentProviderA"]);
    });
  });

  describe.each([
    { hookName: "onModuleDestroy" as const },
    { hookName: "beforeResourceShutdown" as const },
    { hookName: "onResourceShutdown" as const },
  ])("$hookName", ({ hookName }) => {
    it(`should call ${hookName} on a singleton provider`, async () => {
      @Injectable()
      class DependencyProviderA {
        public called = false;

        [hookName]() {
          this.called = true;
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

      await dependencyManager.destroyAll();

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.called).toBe(true);
    });

    it(`should call ${hookName} on a controller`, async () => {
      @Controller()
      class ControllerProviderA {
        public called = false;

        [hookName]() {
          this.called = true;
        }
      }

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

      const controllerProviderAInstance = getControllerInstance<ControllerProviderA>(ControllerProviderA);

      await dependencyManager.destroyAll();

      expect(controllerProviderAInstance).toBeInstanceOf(ControllerProviderA);
      expect(controllerProviderAInstance?.called).toBe(true);
    });

    it(`should await async ${hookName} before continuing`, async () => {
      @Injectable()
      class DependencyProviderA {
        public called = false;

        async [hookName]() {
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.called = true;
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

      await dependencyManager.destroyAll();

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.called).toBe(true);
    });

    it(`should call ${hookName} on a transient provider for each created instance`, async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        public called = false;

        [hookName]() {
          this.called = true;
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public transientProviderA: TransientProviderA) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(public transientProviderA: TransientProviderA) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [TransientProviderA, DependentProviderA, DependentProviderB],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);
      const dependentProviderBInstance = getInstance<DependentProviderB>(DependentProviderB, TestModule);

      await dependencyManager.destroyAll();

      expect(dependentProviderAInstance?.transientProviderA).toBeInstanceOf(TransientProviderA);
      expect(dependentProviderAInstance?.transientProviderA.called).toBe(true);
      expect(dependentProviderAInstance?.transientProviderA).not.toBe(dependentProviderBInstance?.transientProviderA);

      expect(dependentProviderBInstance?.transientProviderA).toBeInstanceOf(TransientProviderA);
      expect(dependentProviderBInstance?.transientProviderA.called).toBe(true);
    });

    it(`should call dependent's ${hookName} before its transient's ${hookName}`, async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        public destroyed = false;

        [hookName]() {
          this.destroyed = true;
        }
      }

      @Injectable()
      class DependentProviderA {
        public destroyed = false;

        constructor(public transientProviderA: TransientProviderA) {}

        [hookName]() {
          if (this.transientProviderA.destroyed) {
            throw new Error(`Dependent's ${hookName} fired after its transient was already destroyed`);
          }

          this.destroyed = true;
        }
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

      await dependencyManager.destroyAll();

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.destroyed).toBe(true);
      expect(dependentProviderAInstance?.transientProviderA.destroyed).toBe(true);
    });

    it(`should fire ${hookName} exactly once per transient instance (no double call)`, async () => {
      let callCount = 0;

      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        [hookName]() {
          callCount++;
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public transientProviderA: TransientProviderA) {}
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

      await dependencyManager.destroyAll();

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance?.transientProviderA).toBeInstanceOf(TransientProviderA);

      expect(callCount).toBe(1);
    });

    it(`should log and continue with other instances when ${hookName} throws`, async () => {
      @Injectable()
      class DependencyProviderA {
        public called = false;

        [hookName]() {
          this.called = true;
        }
      }

      @Injectable()
      class DependentProviderA {
        public called = false;

        constructor(public dependencyProviderA: DependencyProviderA) {}

        [hookName]() {
          this.called = true;

          throw new Error(`${hookName} boom`);
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

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      await dependencyManager.destroyAll();

      expect(dependentProviderAInstance?.called).toBe(true);

      expect(dependencyProviderAInstance?.called).toBe(true);
    });

    it(`should call ${hookName} on dependent providers before dependency providers`, async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        async [hookName]() {
          callLog.push("DependencyProviderA");
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        async [hookName]() {
          callLog.push("DependentProviderA");
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

      await dependencyManager.destroyAll();

      expect(callLog).toEqual(["DependentProviderA", "DependencyProviderA"]);
    });

    it(`should call ${hookName} on importing module's providers before imported module's providers`, async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        async [hookName]() {
          callLog.push("DependencyProviderA");
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        async [hookName]() {
          callLog.push("DependentProviderA");
        }
      }

      @BytiumResourceModule({
        name: "importedModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ImportedModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [ImportedModule],
        providers: [DependentProviderA],
      })
      class ImportingModule {}

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      await dependencyManager.destroyAll();

      expect(callLog).toEqual(["DependentProviderA", "DependencyProviderA"]);
    });

    it(`should call ${hookName} on a provider declared in a dynamic module`, async () => {
      @Injectable()
      class DependencyProviderA {
        public called = false;

        async [hookName]() {
          this.called = true;
        }
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
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, DynamicTestModule);

      await dependencyManager.destroyAll();

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.called).toBe(true);
    });

    it(`should call ${hookName} on a provider declared in a @Global module`, async () => {
      @Injectable()
      class DependencyProviderA {
        public called = false;

        async [hookName]() {
          this.called = true;
        }
      }

      @Global()
      @BytiumResourceModule({
        name: "globalModule",
        providers: [DependencyProviderA],
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

      const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, GlobalModule);

      await dependencyManager.destroyAll();

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance?.called).toBe(true);
    });

    it(`should call ${hookName} on dependent providers before dependency providers`, async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        [hookName]() {
          callLog.push("DependencyProviderA");
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        [hookName]() {
          callLog.push("DependentProviderA");
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
      await dependencyManager.destroyAll();

      expect(callLog).toEqual(["DependentProviderA", "DependencyProviderA"]);
    });

    it(`should call ${hookName} on importing module's providers before imported module's providers`, async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        [hookName]() {
          callLog.push("DependencyProviderA");
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        [hookName]() {
          callLog.push("DependentProviderA");
        }
      }

      @BytiumResourceModule({
        name: "importedModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ImportedModule {}

      @BytiumResourceModule({
        name: "importingModule",
        imports: [ImportedModule],
        providers: [DependentProviderA],
      })
      class ImportingModule {}

      @BytiumResource({
        modules: [ImportingModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);
      await dependencyManager.destroyAll();

      expect(callLog).toEqual(["DependentProviderA", "DependencyProviderA"]);
    });
  });

  describe("init ordering across sibling modules", () => {
    it("should construct all providers across all sibling modules before firing any onModuleInit", async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        constructor() {
          callLog.push("DependencyProviderA.ctor");
        }

        onModuleInit(): void {
          callLog.push("DependencyProviderA.init");
        }
      }

      @Injectable()
      class DependencyProviderB {
        constructor() {
          callLog.push("DependencyProviderB.ctor");
        }

        onModuleInit(): void {
          callLog.push("DependencyProviderB.init");
        }
      }

      @BytiumResourceModule({
        name: "moduleA",
        providers: [DependencyProviderA],
      })
      class ModuleA {}

      @BytiumResourceModule({
        name: "moduleB",
        providers: [DependencyProviderB],
      })
      class ModuleB {}

      @BytiumResource({
        modules: [ModuleA, ModuleB],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      expect(callLog).toEqual([
        "DependencyProviderA.ctor",
        "DependencyProviderB.ctor",
        "DependencyProviderA.init",
        "DependencyProviderB.init",
      ]);
    });
  });

  describe("destroy ordering across hook types", () => {
    it("should fire all onModuleDestroy hooks before any beforeResourceShutdown, and all beforeResourceShutdown before any onResourceShutdown", async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        onModuleDestroy(): void {
          callLog.push("DependencyProviderA.onModuleDestroy");
        }

        beforeResourceShutdown(): void {
          callLog.push("DependencyProviderA.beforeResourceShutdown");
        }

        onResourceShutdown(): void {
          callLog.push("DependencyProviderA.onResourceShutdown");
        }
      }

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}

        onModuleDestroy(): void {
          callLog.push("DependentProviderA.onModuleDestroy");
        }

        beforeResourceShutdown(): void {
          callLog.push("DependentProviderA.beforeResourceShutdown");
        }

        onResourceShutdown(): void {
          callLog.push("DependentProviderA.onResourceShutdown");
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
      await dependencyManager.destroyAll();

      expect(callLog).toEqual([
        "DependentProviderA.onModuleDestroy",
        "DependencyProviderA.onModuleDestroy",
        "DependentProviderA.beforeResourceShutdown",
        "DependencyProviderA.beforeResourceShutdown",
        "DependentProviderA.onResourceShutdown",
        "DependencyProviderA.onResourceShutdown",
      ]);
    });

    it("should fire beforeResourceShutdown and onResourceShutdown on the same instance even when its onModuleDestroy throws", async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        onModuleDestroy(): void {
          callLog.push("DependencyProviderA.onModuleDestroy");
          throw new Error("DependencyProviderA destroy failed");
        }

        beforeResourceShutdown(): void {
          callLog.push("DependencyProviderA.beforeResourceShutdown");
        }

        onResourceShutdown(): void {
          callLog.push("DependencyProviderA.onResourceShutdown");
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
      await dependencyManager.destroyAll();

      expect(callLog).toEqual([
        "DependencyProviderA.onModuleDestroy",
        "DependencyProviderA.beforeResourceShutdown",
        "DependencyProviderA.onResourceShutdown",
      ]);
    });
  });

  describe("partial resolution failure", () => {
    it("should not fire destroy hooks on providers that were constructed but never completed init when resolve() failed midway", async () => {
      const destroyCallLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        onModuleDestroy(): void {
          destroyCallLog.push("DependencyProviderA.onModuleDestroy");
        }
      }

      @Injectable()
      class DependencyProviderB {
        constructor() {
          throw new Error("DependencyProviderB constructor failure");
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

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow("DependencyProviderB constructor failure");
      await dependencyManager.destroyAll();

      expect(destroyCallLog).toEqual([]);
    });
  });
});
