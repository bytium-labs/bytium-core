import { BytiumResource, BytiumResourceModule, Injectable } from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType } from "@shared";
import { Tick } from "@citizenfx/decorators/shared/tick.decorator";
import { TicksService } from "@citizenfx/services/ticks.service";
import { TickNotFoundException } from "@citizenfx/exceptions/tick-not-found.exception";
import { Logger } from "@logger";

describe("TicksService", () => {
  let setTickSpy: jest.SpyInstance;
  let dependencyGraph: DependencyGraph;
  let dependencyManager: BytiumDependencyManager;
  const getInstance = <T>(token: GraphTokenType, module: ConstructorType): T | undefined => {
    const moduleNode = dependencyGraph.findModuleNode(module);

    return moduleNode ? (resolveVisibleInstance(dependencyGraph, token, moduleNode)?.instance as T) : undefined;
  };

  beforeAll(() => {
    setTickSpy = jest.spyOn(globalThis, "setTick");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    setTickSpy.mockImplementation(() => 0);
    dependencyGraph = new DependencyGraph();
    dependencyManager = new BytiumDependencyManager(dependencyGraph);
  });

  afterEach(() => {
    dependencyManager.destroyAll();
  });

  it("should resolve the registered tick when TicksService.start is called from the Provider that owns the @Tick method", async () => {
    @Injectable()
    class DependentProviderA {
      constructor(public ticksService: TicksService) {}

      @Tick({ autoStart: false })
      myTick() {}

      enable(): void {
        this.ticksService.start("myTick");
      }
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
    expect(() => dependentProviderAInstance!.enable()).not.toThrow();
  });

  it("should call the provider's @Tick method each time the tick fires", async () => {
    let capturedTickCallback: (() => Promise<void>) | undefined;

    setTickSpy.mockImplementation((cb: () => Promise<void>) => {
      capturedTickCallback = cb;

      return 1;
    });

    @Injectable()
    class DependentProviderA {
      tickCount = 0;

      @Tick({ autoStart: true })
      myTick(): void {
        this.tickCount++;
      }
    }

    @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

    expect(capturedTickCallback).toBeDefined();

    await capturedTickCallback!();
    await capturedTickCallback!();

    expect(dependentProviderAInstance!.tickCount).toBe(2);
  });

  it("should throw TickNotFoundException when TicksService.start is called for an unknown method name", async () => {
    @Injectable()
    class DependentProviderA {
      constructor(public ticksService: TicksService) {}

      @Tick({ autoStart: false })
      myTick() {}

      enableUnknown(): void {
        this.ticksService.start("nonExistentTick");
      }
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

    expect(() => dependentProviderAInstance!.enableUnknown()).toThrow(TickNotFoundException);
  });

  it("should log the rejection via the framework logger when an async @Tick handle rejects", async () => {
    let capturedTickCallback: (() => Promise<void>) | undefined;

    setTickSpy.mockImplementation((cb: () => Promise<void>) => {
      capturedTickCallback = cb;

      return 1;
    });

    const loggerErrorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});

    try {
      @Injectable()
      class DependentProviderA {
        @Tick({ interval: 100, autoStart: true })
        async myTick(): Promise<void> {
          throw new Error("async tick failure");
        }
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

      expect(capturedTickCallback).toBeDefined();

      await capturedTickCallback!();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error while handling @Tick on method myTick in provider DependentProviderA/),
        expect.any(Error),
      );
    } finally {
      loggerErrorSpy.mockRestore();
    }
  });

  it("should return every registered tick from TicksService.startAll for the Provider that owns the @Tick methods", async () => {
    @Injectable()
    class DependentProviderA {
      constructor(public ticksService: TicksService) {}

      @Tick({ autoStart: false })
      firstTick() {}

      @Tick({ autoStart: false })
      secondTick() {}

      enableAll(): void {
        this.ticksService.startAll();
      }
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

    expect(() => dependentProviderAInstance!.enableAll()).not.toThrow();
  });
});
