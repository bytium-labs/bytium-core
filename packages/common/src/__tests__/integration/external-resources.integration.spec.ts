import "reflect-metadata";
import "../restore-timers";
import {
  BytiumResource,
  BytiumResourceModule,
  BytiumResourceStateEnum,
  ExternalDependencyUnavailableException,
  Inject,
  Injectable,
  Transferable,
  WrongDependencyTypeException,
} from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { BytiumExportNameEnum } from "@core/enums/bytium-export-name.enum";

describe("External resources", () => {
  let dependencyGraph: DependencyGraph;
  let dependencyManager: BytiumDependencyManager;

  beforeEach(() => {
    const exportsStore: Record<string, unknown> = {};

    global.exports = new Proxy(
      function exportsFunc(name: string, fn: unknown) {
        exportsStore[name] = fn;
      } as unknown as object,
      {
        get(_target, prop: string) {
          return exportsStore[prop];
        },
        set(_target, prop: string, value: unknown) {
          exportsStore[prop] = value;

          return true;
        },
      },
    ) as never;

    global.GetResourceState = () => "started";

    dependencyGraph = new DependencyGraph();
    dependencyManager = new BytiumDependencyManager(dependencyGraph);
  });

  afterEach(async () => {
    await dependencyManager.destroyAll();
  });

  const mockRemoteBytiumResource = (
    resourceName: string,
    options: {
      state?: BytiumResourceStateEnum;
      modules?: Record<string, string[]>;
      providers?: Record<string, () => unknown>;
    } = {},
  ) => {
    global.exports[resourceName] = {
      [BytiumExportNameEnum.BYTIUM_RESOURCE_STATE]: () => options.state ?? BytiumResourceStateEnum.STARTED,
      ...Object.fromEntries(Object.entries(options.modules ?? {}).map(([name, names]) => [name, () => names])),
      ...(options.providers ?? {}),
    };
  };

  describe("ExternalResource (resource-level import)", () => {
    it("should resolve a resource that imports a started external bytium resource", async () => {
      mockRemoteBytiumResource("remote-resource");

      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA],
      })
      class TestModule {}

      @BytiumResource({
        imports: ["remote-resource"],
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).resolves.not.toThrow();
    });

    it("should throw when the external resource reports a non-started CitizenFX state", async () => {
      global.GetResourceState = () => "stopped";

      @BytiumResourceModule({ name: "testModule" })
      class TestModule {}

      @BytiumResource({
        imports: ["remote-resource"],
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(ExternalDependencyUnavailableException);
    });

    it("should throw when the external resource does not expose Bytium resource state", async () => {
      global.exports["remote-resource"] = {};

      @BytiumResourceModule({ name: "testModule" })
      class TestModule {}

      @BytiumResource({
        imports: ["remote-resource"],
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(ExternalDependencyUnavailableException);
    });

    it("should throw ExternalDependencyUnavailableException when an external resource stays STARTING past the timeout", async () => {
      jest.useFakeTimers();
      mockRemoteBytiumResource("remote-resource", { state: BytiumResourceStateEnum.STARTING });

      @BytiumResourceModule({ name: "testModule" })
      class TestModule {}

      @BytiumResource({
        imports: ["remote-resource"],
        modules: [TestModule],
      })
      class TestResource {}

      const resolvePromise = dependencyManager.resolve(TestResource);

      resolvePromise.catch((): void => undefined);

      const flushMicrotasks = async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      };

      await flushMicrotasks();

      for (let i = 0; i < 35; i++) {
        jest.advanceTimersByTime(1000);
        await flushMicrotasks();
      }

      await expect(resolvePromise).rejects.toThrow(/Timeout waiting for bytium resource/);

      jest.useRealTimers();
    });

    it("should honor externalResourceTimeoutMs on BytiumResource - throwing after the configured duration instead of the default 30s", async () => {
      jest.useFakeTimers();
      mockRemoteBytiumResource("remote-resource", { state: BytiumResourceStateEnum.STARTING });

      @BytiumResourceModule({ name: "testModule" })
      class TestModule {}

      @BytiumResource({
        imports: ["remote-resource"],
        modules: [TestModule],
        externalResourceTimeoutMs: 5000,
      })
      class TestResource {}

      const resolvePromise = dependencyManager.resolve(TestResource);

      resolvePromise.catch((): void => undefined);

      const flushMicrotasks = async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      };

      await flushMicrotasks();

      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(1000);
        await flushMicrotasks();
      }

      await expect(resolvePromise).rejects.toThrow(/Timeout waiting for bytium resource/);

      jest.useRealTimers();
    });
  });

  describe("ExternalModule (cross-resource module import)", () => {
    it("should resolve a module that imports an external module", async () => {
      mockRemoteBytiumResource("remote-resource", {
        modules: { remoteModule: ["RemoteProvider"] },
        providers: { "remoteModule:RemoteProvider": () => ({ greet: () => "hello" }) },
      });

      @BytiumResourceModule({
        name: "testModule",
        imports: ["remote-resource:remoteModule"],
      })
      class TestModule {}

      @BytiumResource({
        imports: ["remote-resource"],
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).resolves.not.toThrow();
    });

    it("should throw when the external resource hosting the module is not started", async () => {
      global.GetResourceState = () => "stopped";

      @BytiumResourceModule({
        name: "testModule",
        imports: ["remote-resource:remoteModule"],
      })
      class TestModule {}

      @BytiumResource({
        imports: ["remote-resource"],
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(ExternalDependencyUnavailableException);
    });

    it("should throw when the remote resource does not export the requested module", async () => {
      mockRemoteBytiumResource("remote-resource");

      @BytiumResourceModule({
        name: "testModule",
        imports: ["remote-resource:remoteModule"],
      })
      class TestModule {}

      @BytiumResource({
        imports: ["remote-resource"],
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(ExternalDependencyUnavailableException);
    });

    it("should filter null and undefined entries from the remote module's provider names list", async () => {
      mockRemoteBytiumResource("remote-resource", {
        modules: { remoteModule: ["RemoteProvider", null as unknown as string, undefined as unknown as string, ""] },
        providers: { "remoteModule:RemoteProvider": () => ({ value: 42 }) },
      });

      @BytiumResourceModule({
        name: "testModule",
        imports: ["remote-resource:remoteModule"],
      })
      class TestModule {}

      @BytiumResource({
        imports: ["remote-resource"],
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).resolves.not.toThrow();
    });
  });

  describe("ExternalProvider (cross-resource provider injection)", () => {
    it("should inject an external provider into a local provider via @Inject", async () => {
      const remoteProviderAInstance = { greet: () => "hello from remote" };

      mockRemoteBytiumResource("remote-resource", {
        modules: { remoteModule: ["RemoteProviderA"] },
        providers: { "remoteModule:RemoteProviderA": () => remoteProviderAInstance },
      });

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("remote-resource:remoteModule:RemoteProviderA") public remote: { greet: () => string }) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        imports: ["remote-resource:remoteModule"],
        providers: [DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        imports: ["remote-resource"],
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = dependencyGraph.getNode(DependentProviderA)?.instances[0]
        ?.instance as DependentProviderA;

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance.remote.greet()).toBe("hello from remote");
    });

    it("should throw when the remote module does not export the requested provider", async () => {
      mockRemoteBytiumResource("remote-resource", {
        modules: { remoteModule: ["RemoteProviderA"] },
      });

      @Injectable()
      class DependentProviderA {
        constructor(@Inject("remote-resource:remoteModule:RemoteProviderA") public remote: unknown) {}
      }

      @BytiumResourceModule({
        name: "testModule",
        imports: ["remote-resource:remoteModule"],
        providers: [DependentProviderA],
      })
      class TestModule {}

      @BytiumResource({
        imports: ["remote-resource"],
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(ExternalDependencyUnavailableException);
    });

    it("should NOT classify malformed colon-tokens as external providers - falling through to regular validation", async () => {
      @Injectable()
      class DependentProviderA {
        constructor(@Inject("a::b") public broken: unknown) {}
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

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(/a::b/);
    });
  });

  describe("crossResourceExports (@Transferable)", () => {
    it("should throw when a provider in crossResourceExports lacks the @Transferable decorator", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA],
        crossResourceExports: [DependencyProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await expect(dependencyManager.resolve(TestResource)).rejects.toThrow(WrongDependencyTypeException);
    });

    it("should register module and provider names on global.exports when @Transferable is present", async () => {
      @Transferable("DependencyProviderA")
      @Injectable()
      class DependencyProviderA {
        greet(): string {
          return "hello from local";
        }
      }

      @BytiumResourceModule({
        name: "testModule",
        providers: [DependencyProviderA],
        crossResourceExports: [DependencyProviderA],
      })
      class TestModule {}

      @BytiumResource({
        modules: [TestModule],
      })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const moduleProviderNames = (global.exports["testModule"] as unknown as () => string[])();
      const remoteProviderFactory = global.exports[
        "testModule:DependencyProviderA"
      ] as unknown as () => DependencyProviderA;
      const remoteResolvedInstance = remoteProviderFactory();

      expect(moduleProviderNames).toContain("DependencyProviderA");

      expect(remoteResolvedInstance).toBeInstanceOf(DependencyProviderA);
      expect(remoteResolvedInstance.greet()).toBe("hello from local");
    });
  });
});
