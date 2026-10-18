import "reflect-metadata";
import "../restore-timers";
import { HandlerInvoker } from "@core";
import { ParamDecoratorEntryInterface } from "@core/interfaces/param-decorator-entry.interface";
import { AnyExecutionContext } from "@core/types/any-execution-context.type";
import { CallbacksRegistry } from "@citizenfx/registries/callbacks.registry";
import { CallbacksService } from "@citizenfx/services/callbacks.service";
import { InvocationContextInterface } from "@invocation/interfaces/invocation-context.interface";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";
import { BytiumMetadataEnum, ConstructorType } from "@shared";

describe("callback correlation envelope", () => {
  const envelope = { __bytiumCorrelationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f" };
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  let capturedOnListener: ((...args: unknown[]) => void) | undefined;
  let lastEmittedArgs: unknown[];
  const stampArgsDecorator = (target: ConstructorType, methodName: string): void => {
    const entries: ParamDecoratorEntryInterface[] = [
      { factory: (_data, context) => (context as AnyExecutionContext & { args: unknown[] }).args, data: undefined },
    ];

    Reflect.defineMetadata(BytiumMetadataEnum.PARAM_DECORATORS, entries, target.prototype, methodName);
  };
  const flush = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
  };

  class DependentProviderA {
    receivedArgs: unknown[] = [];
    context: InvocationContextInterface | undefined;

    handle(args: unknown[]) {
      this.receivedArgs = args;
      this.context = invocationContextManagerInstance.getContext();
    }
  }

  beforeAll(() => {
    jest.spyOn(globalThis, "IsDuplicityVersion").mockReturnValue(true);
    jest.spyOn(globalThis, "on").mockImplementation((_name, listener) => {
      capturedOnListener = listener as (...args: unknown[]) => void;
    });
    jest.spyOn(globalThis, "emit").mockImplementation((name, ...args) => {
      lastEmittedArgs = [name, ...args];
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    lastEmittedArgs = [];

    stampArgsDecorator(DependentProviderA, "handle");
  });

  it("should append the correlation envelope when a local @Callback is invoked inside an invocation flow", () => {
    const callbacksServiceInstance = new CallbacksService();
    const dependentProviderAInstance = new DependentProviderA();
    let activeCorrelationId: string | undefined;
    const context = {
      type: "COMMAND",
      provider: dependentProviderAInstance,
      methodName: "handle",
      source: "0",
      rawSource: 0,
      args: [],
      rawCommand: "",
    };

    new HandlerInvoker().runCorrelated(context, () => {
      activeCorrelationId = invocationContextManagerInstance.getContext()?.correlationId;
      void callbacksServiceInstance.invoke("getStatus", { ping: true });
    });

    expect(activeCorrelationId).toMatch(uuidPattern);

    expect(lastEmittedArgs[0]).toBe("__bytium_callbackCall:getStatus");
    expect(lastEmittedArgs[2]).toEqual({ ping: true });
    expect(lastEmittedArgs[3]).toEqual({ __bytiumCorrelationId: activeCorrelationId });

    capturedOnListener!(lastEmittedArgs[1], { ok: true });
  });

  it("should not append an envelope when a local @Callback is invoked outside any invocation flow", () => {
    const callbacksServiceInstance = new CallbacksService();

    void callbacksServiceInstance.invoke("getStatus", { ping: true });

    expect(lastEmittedArgs).toHaveLength(3);
    expect(lastEmittedArgs[2]).toEqual({ ping: true });

    capturedOnListener!(lastEmittedArgs[1], { ok: true });
  });

  it("should strip the envelope and inherit the correlationId in a @Callback handler", async () => {
    const dependentProviderAInstance = new DependentProviderA();

    new CallbacksRegistry().registerCallback(
      dependentProviderAInstance,
      "handle",
      { name: "resource:module:callback" },
      DependentProviderA,
      new HandlerInvoker(),
    );

    capturedOnListener!("response-1", 1, "two", envelope);
    await flush();

    expect(dependentProviderAInstance.receivedArgs).toEqual([1, "two"]);
    expect(dependentProviderAInstance.context?.correlationId).toBe("0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f");
  });

  it("should mint a fresh correlationId in a @Callback handler when the envelope is absent", async () => {
    const dependentProviderAInstance = new DependentProviderA();

    new CallbacksRegistry().registerCallback(
      dependentProviderAInstance,
      "handle",
      { name: "resource:module:callback" },
      DependentProviderA,
      new HandlerInvoker(),
    );

    capturedOnListener!("response-1", 1, "two");
    await flush();

    expect(dependentProviderAInstance.receivedArgs).toEqual([1, "two"]);
    expect(dependentProviderAInstance.context?.correlationId).toMatch(uuidPattern);
  });
});
