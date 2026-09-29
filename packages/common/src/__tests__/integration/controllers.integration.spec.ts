import "reflect-metadata";
import { BytiumResource, BytiumResourceModule, Controller, Injectable } from "@core";
import { Command } from "@citizenfx/decorators/client/command.decorator";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { WrongDependencyTypeException } from "@core/exceptions/wrong-dependency-type.exception";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType } from "@shared";
import { Logger } from "@logger";

describe("Controllers", () => {
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

  afterEach(async () => {
    await dependencyManager.destroyAll();
  });

  it("should resolve a @Controller and inject its provider dependencies", async () => {
    @Injectable()
    class DependencyProviderA {}

    @Controller()
    class ControllerA {
      constructor(public dependencyProviderA: DependencyProviderA) {}
    }

    @BytiumResourceModule({ name: "testModule", providers: [DependencyProviderA], controllers: [ControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const dependencyProviderAInstance = getInstance<DependencyProviderA>(DependencyProviderA, TestModule);
    const controllerAInstance = getControllerInstance<ControllerA>(ControllerA);

    expect(controllerAInstance).toBeInstanceOf(ControllerA);
    expect(controllerAInstance?.dependencyProviderA).toBe(dependencyProviderAInstance);
  });

  it("should not allow a @Controller to be injected as a dependency", async () => {
    @Controller()
    class ControllerA {}

    @Injectable()
    class DependentProviderA {
      constructor(public controllerA: ControllerA) {}
    }

    @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA], controllers: [ControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    const thrown = await dependencyManager.resolve(TestResource).catch((error) => error);

    expect(thrown).toBeInstanceOf(WrongDependencyTypeException);
    expect((thrown as Error).message).toContain("ControllerA");
    expect((thrown as Error).message).toContain("cannot be injected");
  });

  it("should reject an @Injectable provider placed in the controllers array", async () => {
    @Injectable()
    class NotAControllerA {}

    @BytiumResourceModule({ name: "testModule", controllers: [NotAControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    const thrown = await dependencyManager.resolve(TestResource).catch((error) => error);

    expect(thrown).toBeInstanceOf(WrongDependencyTypeException);
    expect((thrown as Error).message).toContain("@Controller()");
  });

  describe("request-like handler enforcement", () => {
    let registeredCommandHandlers: Record<string, (source: number, args: string[], rawCommand: string) => void>;
    let originalRegisterCommand: typeof RegisterCommand;
    const flushMicrotasks = async (): Promise<void> => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    };

    beforeEach(() => {
      registeredCommandHandlers = {};
      originalRegisterCommand = global.RegisterCommand;
      global.RegisterCommand = ((
        name: string,
        handler: (source: number, args: string[], rawCommand: string) => void,
      ) => {
        registeredCommandHandlers[name] = handler;
      }) as unknown as typeof RegisterCommand;
    });

    afterEach(() => {
      global.RegisterCommand = originalRegisterCommand;
    });

    it("should register and run a @Command handler declared on a @Controller", async () => {
      let handlerRan = false;

      @Controller()
      class ControllerA {
        @Command("test")
        handle() {
          handlerRan = true;
        }
      }

      @BytiumResourceModule({ name: "testModule", controllers: [ControllerA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      registeredCommandHandlers["test"](5, [], "test");
      await flushMicrotasks();

      expect(handlerRan).toBe(true);
    });

    it("should not register a @Command handler declared on a non-controller provider", async () => {
      const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

      @Injectable()
      class ServiceA {
        @Command("test")
        handle() {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [ServiceA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      expect(registeredCommandHandlers["test"]).toBeUndefined();

      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls.some(([message]) => String(message).includes("ServiceA"))).toBe(true);

      warnSpy.mockRestore();
    });
  });
});
