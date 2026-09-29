import "reflect-metadata";
import { BytiumResource, BytiumResourceModule, ForbiddenException, HandlerInvoker, Injectable } from "@core";
import { ParamDecoratorEntryInterface } from "@core/interfaces/param-decorator-entry.interface";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { AnyExecutionContext } from "@core/types/any-execution-context.type";
import { GraphTokenType } from "@core/types/graph-token.type";
import { BytiumMetadataEnum, ConstructorType } from "@shared";

describe("HandlerInvoker", () => {
  const stampParamDecorators = (
    target: ConstructorType,
    methodName: string,
    entries: (ParamDecoratorEntryInterface | undefined)[],
  ): void => {
    Reflect.defineMetadata(BytiumMetadataEnum.PARAM_DECORATORS, entries, target.prototype, methodName);
  };
  const buildContext = (
    provider: object,
    overrides: { type: string } & Record<string, unknown>,
  ): AnyExecutionContext => ({
    provider,
    methodName: "handle",
    ...overrides,
  });

  describe("invoke", () => {
    it("should resolve a parameter from its param decorator factory using the execution context", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        receivedArgs: unknown[] = [];

        handle(args: unknown[]) {
          this.receivedArgs = args;
        }
      }

      stampParamDecorators(DependentProviderA, "handle", [
        { factory: (_data, context) => (context as AnyExecutionContext & { args: unknown[] }).args, data: undefined },
      ]);

      const dependentProviderAInstance = new DependentProviderA();

      await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command", args: [1, 2] }));

      expect(dependentProviderAInstance.receivedArgs).toEqual([1, 2]);
    });

    it("should re-run the param decorator factory against each context when the same handler is invoked repeatedly", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        received: unknown[] = [];

        handle(args: unknown[]) {
          this.received = args;
        }
      }

      stampParamDecorators(DependentProviderA, "handle", [
        { factory: (_data, context) => (context as AnyExecutionContext & { args: unknown[] }).args, data: undefined },
      ]);

      const dependentProviderAInstance = new DependentProviderA();

      await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command", args: [1, 2] }));

      expect(dependentProviderAInstance.received).toEqual([1, 2]);

      await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command", args: [3, 4] }));

      expect(dependentProviderAInstance.received).toEqual([3, 4]);
    });

    it("should resolve multiple parameters in declaration order and leave undecorated gaps undefined", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        received: unknown[] = [];

        handle(...passedArgs: unknown[]) {
          this.received = passedArgs;
        }
      }

      stampParamDecorators(DependentProviderA, "handle", [
        { factory: () => "first", data: undefined },
        undefined,
        { factory: () => "third", data: undefined },
      ]);

      const dependentProviderAInstance = new DependentProviderA();

      await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" }));

      expect(dependentProviderAInstance.received).toEqual(["first", undefined, "third"]);
    });

    it("should pass the param decorator data argument through to the factory", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        received: unknown;

        handle(value: unknown) {
          this.received = value;
        }
      }

      stampParamDecorators(DependentProviderA, "handle", [
        { factory: (data) => `field:${String(data)}`, data: "licenseId" },
      ]);

      const dependentProviderAInstance = new DependentProviderA();

      await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" }));

      expect(dependentProviderAInstance.received).toBe("field:licenseId");
    });

    it("should await an async param decorator factory before invoking the handler", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        received: unknown;

        handle(value: unknown) {
          this.received = value;
        }
      }

      stampParamDecorators(DependentProviderA, "handle", [
        { factory: () => Promise.resolve("resolved-async"), data: undefined },
      ]);

      const dependentProviderAInstance = new DependentProviderA();

      await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" }));

      expect(dependentProviderAInstance.received).toBe("resolved-async");
    });

    it("should return the handler's return value", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        handle() {
          return { ok: true };
        }
      }

      const dependentProviderAInstance = new DependentProviderA();
      const result = await handlerInvoker.invoke<{ ok: boolean }>(
        buildContext(dependentProviderAInstance, { type: "callback" }),
      );

      expect(result).toEqual({ ok: true });
    });

    it("should propagate an error thrown by a param decorator factory", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        handle(_value: unknown) {}
      }

      stampParamDecorators(DependentProviderA, "handle", [
        {
          factory: () => {
            throw new Error("factory exploded");
          },
          data: undefined,
        },
      ]);

      const dependentProviderAInstance = new DependentProviderA();

      await expect(
        handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" })),
      ).rejects.toThrow("factory exploded");
    });
  });

  describe("injection", () => {
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
        constructor(public handlerInvoker: HandlerInvoker) {}
      }

      @BytiumResourceModule({ name: "testModule", providers: [DependentProviderA] })
      class TestModule {}

      @BytiumResource({ modules: [TestModule] })
      class TestResource {}

      await dependencyManager.resolve(TestResource);

      const dependentProviderAInstance = getInstance<DependentProviderA>(DependentProviderA, TestModule);

      expect(dependentProviderAInstance?.handlerInvoker).toBeInstanceOf(HandlerInvoker);
    });
  });

  describe("guards", () => {
    it("should not invoke the handler when a guard denies", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        wasCalled = false;

        handle() {
          this.wasCalled = true;
        }
      }

      const dependentProviderAInstance = new DependentProviderA();

      handlerInvoker.registerPipeline(dependentProviderAInstance, "handle", {
        guards: [{ canActivate: () => false }],
      });

      await expect(
        handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" })),
      ).rejects.toThrow(ForbiddenException);

      expect(dependentProviderAInstance.wasCalled).toBe(false);
    });

    it("should invoke the handler when every guard allows", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        wasCalled = false;

        handle() {
          this.wasCalled = true;
        }
      }

      const dependentProviderAInstance = new DependentProviderA();

      handlerInvoker.registerPipeline(dependentProviderAInstance, "handle", {
        guards: [{ canActivate: () => true }, { canActivate: async () => true }],
      });

      await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" }));

      expect(dependentProviderAInstance.wasCalled).toBe(true);
    });
  });

  describe("pipes", () => {
    it("should transform every argument through the pipeline pipes before the handler runs", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        received: unknown[] = [];

        handle(...passedArgs: unknown[]) {
          this.received = passedArgs;
        }
      }

      stampParamDecorators(DependentProviderA, "handle", [
        { factory: () => 5, data: undefined },
        { factory: () => 10, data: undefined },
      ]);

      const dependentProviderAInstance = new DependentProviderA();

      handlerInvoker.registerPipeline(dependentProviderAInstance, "handle", {
        pipes: [{ transform: (value) => (value as number) * 2 }],
      });

      await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" }));

      expect(dependentProviderAInstance.received).toEqual([10, 20]);
    });

    it("should apply pipes in order", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        received: unknown[] = [];

        handle(...passedArgs: unknown[]) {
          this.received = passedArgs;
        }
      }

      stampParamDecorators(DependentProviderA, "handle", [{ factory: () => 5, data: undefined }]);

      const dependentProviderAInstance = new DependentProviderA();

      handlerInvoker.registerPipeline(dependentProviderAInstance, "handle", {
        pipes: [{ transform: (value) => (value as number) * 2 }, { transform: (value) => (value as number) + 1 }],
      });

      await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" }));

      expect(dependentProviderAInstance.received).toEqual([11]);
    });
  });

  describe("interceptors", () => {
    it("should run interceptor logic before and after the handler", async () => {
      const calls: string[] = [];
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        handle() {
          calls.push("handler");
        }
      }

      const dependentProviderAInstance = new DependentProviderA();

      handlerInvoker.registerPipeline(dependentProviderAInstance, "handle", {
        interceptors: [
          {
            async intercept(_context, next) {
              calls.push("before");
              const result = await next();

              calls.push("after");

              return result;
            },
          },
        ],
      });

      await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" }));

      expect(calls).toEqual(["before", "handler", "after"]);
    });

    it("should let an interceptor transform the handler result", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        handle() {
          return 5;
        }
      }

      const dependentProviderAInstance = new DependentProviderA();

      handlerInvoker.registerPipeline(dependentProviderAInstance, "handle", {
        interceptors: [
          {
            async intercept(_context, next) {
              return ((await next()) as number) * 2;
            },
          },
        ],
      });

      const result = await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" }));

      expect(result).toBe(10);
    });

    it("should compose interceptors with the first registered as the outermost", async () => {
      const calls: string[] = [];
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        handle() {
          calls.push("handler");
        }
      }

      const dependentProviderAInstance = new DependentProviderA();

      handlerInvoker.registerPipeline(dependentProviderAInstance, "handle", {
        interceptors: [
          {
            async intercept(_context, next) {
              calls.push("a:before");
              const result = await next();

              calls.push("a:after");

              return result;
            },
          },
          {
            async intercept(_context, next) {
              calls.push("b:before");
              const result = await next();

              calls.push("b:after");

              return result;
            },
          },
        ],
      });

      await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" }));

      expect(calls).toEqual(["a:before", "b:before", "handler", "b:after", "a:after"]);
    });
  });

  describe("exception filters", () => {
    it("should route a thrown error to a matching filter and return its result", async () => {
      class CommandFailedException extends Error {}
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        handle(): void {
          throw new CommandFailedException("boom");
        }
      }

      const dependentProviderAInstance = new DependentProviderA();
      let caught: unknown = null;

      handlerInvoker.registerPipeline(dependentProviderAInstance, "handle", {
        filters: [
          {
            filter: {
              catch: (exception) => {
                caught = exception;

                return "handled";
              },
            },
            exceptions: [CommandFailedException],
          },
        ],
      });

      const result = await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" }));

      expect(caught).toBeInstanceOf(CommandFailedException);

      expect(result).toBe("handled");
    });

    it("should catch an error thrown by a guard since the filter is the outermost barrier", async () => {
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        handle(): void {}
      }

      const dependentProviderAInstance = new DependentProviderA();
      let caught: unknown = null;

      handlerInvoker.registerPipeline(dependentProviderAInstance, "handle", {
        guards: [{ canActivate: () => false }],
        filters: [
          {
            filter: {
              catch: (exception) => {
                caught = exception;

                return "denied";
              },
            },
            exceptions: [],
          },
        ],
      });

      const result = await handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" }));

      expect(caught).toBeInstanceOf(ForbiddenException);

      expect(result).toBe("denied");
    });

    it("should rethrow when no filter matches the exception type", async () => {
      class HandledException extends Error {}
      class UnhandledException extends Error {}
      const handlerInvoker = new HandlerInvoker();

      class DependentProviderA {
        handle(): void {
          throw new UnhandledException("nope");
        }
      }

      const dependentProviderAInstance = new DependentProviderA();

      handlerInvoker.registerPipeline(dependentProviderAInstance, "handle", {
        filters: [{ filter: { catch: () => "handled" }, exceptions: [HandledException] }],
      });

      await expect(
        handlerInvoker.invoke(buildContext(dependentProviderAInstance, { type: "command" })),
      ).rejects.toThrow(UnhandledException);
    });
  });
});
