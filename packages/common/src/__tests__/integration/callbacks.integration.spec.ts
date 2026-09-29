import "reflect-metadata";
import "../restore-timers";
import { BytiumException } from "@core";
import { CallbacksService } from "@citizenfx/services/callbacks.service";
import { serializeError } from "@citizenfx/utils/error-serialization.utils";

describe("CallbacksService", () => {
  let originalEmit: typeof emit;
  let originalOn: typeof on;
  let eventHandlers: Record<string, (...args: unknown[]) => void>;
  let lastEmittedArgs: unknown[];

  beforeEach(() => {
    originalEmit = global.emit;
    originalOn = global.on;
    eventHandlers = {};
    lastEmittedArgs = [];

    global.on = ((name: string, handler: (...args: unknown[]) => void) => {
      eventHandlers[name] = handler;
    }) as typeof on;
    global.emit = ((name: string, ...args: unknown[]) => {
      lastEmittedArgs = [name, ...args];
    }) as typeof emit;
  });

  afterEach(() => {
    global.emit = originalEmit;
    global.on = originalOn;
  });

  const triggerResponse = (eventName: string, responseIdentifier: string, ...args: unknown[]): void => {
    eventHandlers[eventName](responseIdentifier, ...args);
  };

  it("should resolve with the value emitted by the receiver in response to a local @Callback invocation", async () => {
    const callbacksServiceInstance = new CallbacksService();
    const invocationPromise = callbacksServiceInstance.invoke<{ ok: boolean }>("getStatus");
    const [eventName, responseIdentifier] = lastEmittedArgs as [string, string];

    expect(eventName).toBe("__bytium_callbackCall:getStatus");

    triggerResponse("__bytium_callbackResponse:getStatus", responseIdentifier, { ok: true });

    await expect(invocationPromise).resolves.toEqual({ ok: true });
  });

  it("should reject with the sanitized generic error when the receiver emits an unexpected error payload", async () => {
    const callbacksServiceInstance = new CallbacksService();
    const invocationPromise = callbacksServiceInstance.invoke<unknown>("failingHandler");
    const [, responseIdentifier] = lastEmittedArgs as [string, string];
    const serializedError = serializeError(new Error("handler exploded"));

    triggerResponse("__bytium_callbackResponse:failingHandler", responseIdentifier, serializedError);

    await expect(invocationPromise).rejects.toThrow("Internal server error");
  });

  it("should preserve a BytiumException's name and code through the serialized error round-trip", async () => {
    const callbacksServiceInstance = new CallbacksService();
    const invocationPromise = callbacksServiceInstance.invoke<unknown>("failingHandler");
    const [, responseIdentifier] = lastEmittedArgs as [string, string];
    const serializedError = serializeError(new BytiumException("ace already exists", "ACE_ALREADY_EXISTS"));

    triggerResponse("__bytium_callbackResponse:failingHandler", responseIdentifier, serializedError);

    const thrown = (await invocationPromise.catch((error) => error)) as BytiumException;

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.name).toBe("BytiumException");
    expect(thrown.message).toBe("ace already exists");
    expect(thrown.code).toBe("ACE_ALREADY_EXISTS");
  });

  it("should reject with a timeout error when no response arrives within the default timeout window", async () => {
    jest.useFakeTimers();

    const callbacksServiceInstance = new CallbacksService();
    const invocationPromise = callbacksServiceInstance.invoke<unknown>("neverResponds");

    invocationPromise.catch((): void => undefined);

    jest.advanceTimersByTime(30001);

    await expect(invocationPromise).rejects.toThrow(/timed out/);

    jest.useRealTimers();
  });

  it("should not mis-classify an Array argument that carries a __bytiumError property as a serialized error", async () => {
    const callbacksServiceInstance = new CallbacksService();
    const invocationPromise = callbacksServiceInstance.invoke<number[]>("arrayResponder");
    const [, responseIdentifier] = lastEmittedArgs as [string, string];
    const arrayWithStrayKey = [1, 2, 3] as unknown as Record<string, unknown>;

    arrayWithStrayKey.__bytiumError = "should-be-ignored";

    triggerResponse("__bytium_callbackResponse:arrayResponder", responseIdentifier, arrayWithStrayKey);

    const resolvedValue = await invocationPromise;

    expect(Array.isArray(resolvedValue)).toBe(true);
    expect(resolvedValue).toHaveLength(3);
    expect(resolvedValue[0]).toBe(1);
    expect(resolvedValue[1]).toBe(2);
    expect(resolvedValue[2]).toBe(3);
  });
});
