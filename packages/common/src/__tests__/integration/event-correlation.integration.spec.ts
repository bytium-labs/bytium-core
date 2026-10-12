import "reflect-metadata";
import { HandlerInvoker } from "@core";
import { ParamDecoratorEntryInterface } from "@core/interfaces/param-decorator-entry.interface";
import { AnyExecutionContext } from "@core/types/any-execution-context.type";
import { EventsRegistry } from "@citizenfx/registries/events.registry";
import { InvocationContextInterface } from "@invocation/interfaces/invocation-context.interface";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";
import { BytiumMetadataEnum, ConstructorType } from "@shared";

describe("event correlation envelope", () => {
  const envelope = { __bytiumCorrelationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f" };
  let originalIsDuplicityVersion: unknown;
  let capturedOnListener: ((...args: unknown[]) => void) | undefined;
  let capturedOnNetListener: ((...args: unknown[]) => void) | undefined;
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
    originalIsDuplicityVersion = (global as any).IsDuplicityVersion;
    (global as any).IsDuplicityVersion = () => true;
  });

  afterAll(() => {
    (global as any).IsDuplicityVersion = originalIsDuplicityVersion;
  });

  beforeEach(() => {
    (global as any).on = (_name: string, listener: (...args: unknown[]) => void) => {
      capturedOnListener = listener;
    };
    (global as any).onNet = (_name: string, listener: (...args: unknown[]) => void) => {
      capturedOnNetListener = listener;
    };
    stampArgsDecorator(DependentProviderA, "handle");
  });

  afterEach(() => {
    (global as any).on = () => {};
    (global as any).onNet = () => {};
  });

  it("should strip the envelope and inherit the correlationId in an @OnEvent handler", async () => {
    const dependentProviderAInstance = new DependentProviderA();

    new EventsRegistry().registerEventListener(
      dependentProviderAInstance,
      "handle",
      { name: "resource:module:event" },
      DependentProviderA,
      new HandlerInvoker(),
    );

    capturedOnListener!(1, "two", envelope);
    await flush();

    expect(dependentProviderAInstance.receivedArgs).toEqual([1, "two"]);
    expect(dependentProviderAInstance.context?.correlationId).toBe("0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f");
  });

  it("should strip the envelope and inherit the correlationId in an @OnNetEvent handler", async () => {
    const dependentProviderAInstance = new DependentProviderA();

    new EventsRegistry().registerNetEventListener(
      dependentProviderAInstance,
      "handle",
      { name: "resource:module:event" },
      DependentProviderA,
      new HandlerInvoker(),
    );

    capturedOnNetListener!(1, "two", envelope);
    await flush();

    expect(dependentProviderAInstance.receivedArgs).toEqual([1, "two"]);
    expect(dependentProviderAInstance.context?.correlationId).toBe("0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f");
  });

  it("should ignore the envelope's correlationId when the net event comes from a player", async () => {
    const dependentProviderAInstance = new DependentProviderA();

    new EventsRegistry().registerNetEventListener(
      dependentProviderAInstance,
      "handle",
      { name: "resource:module:event" },
      DependentProviderA,
      new HandlerInvoker(),
    );

    (global as any).source = 42;
    capturedOnNetListener!(1, "two", envelope);
    await flush();
    (global as any).source = 0;

    expect(dependentProviderAInstance.receivedArgs).toEqual([1, "two"]);
    expect(dependentProviderAInstance.context?.correlationId).not.toBe("0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f");
    expect(dependentProviderAInstance.context?.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("should leave a net event without an envelope untouched and mint a fresh correlationId", async () => {
    const dependentProviderAInstance = new DependentProviderA();

    new EventsRegistry().registerNetEventListener(
      dependentProviderAInstance,
      "handle",
      { name: "resource:module:event" },
      DependentProviderA,
      new HandlerInvoker(),
    );

    capturedOnNetListener!(1, { detail: "plain data" });
    await flush();

    expect(dependentProviderAInstance.receivedArgs).toEqual([1, { detail: "plain data" }]);
    expect(dependentProviderAInstance.context?.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
