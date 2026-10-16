import { EventsRegistry } from "@citizenfx/registries/events.registry";
import { HandlerInvoker } from "@core/invokers/handler.invoker";
import { Logger } from "@logger";

class ProviderA {}

describe("EventsRegistry environment guards", () => {
  const handlerInvoker = {} as HandlerInvoker;
  let isDuplicityVersionSpy: jest.SpyInstance<boolean, []>;
  let onSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  const buildRegistryFor = (isServer: boolean): EventsRegistry => {
    isDuplicityVersionSpy.mockReturnValue(isServer);

    return new EventsRegistry();
  };

  beforeAll(() => {
    isDuplicityVersionSpy = jest.spyOn(globalThis, "IsDuplicityVersion");
    onSpy = jest.spyOn(globalThis, "on");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    isDuplicityVersionSpy.mockReturnValue(false);
  });

  describe.each([
    ["registerServerResourceStartEventListener", "onServerResourceStart"] as const,
    ["registerServerResourceStopEventListener", "onServerResourceStop"] as const,
  ])("%s (server-only)", (method, event) => {
    it("registers the listener and does not warn on the server", () => {
      const eventsRegistryInstance = buildRegistryFor(true);

      eventsRegistryInstance[method]({}, "handler", { name: "resourceA" } as never, ProviderA, handlerInvoker);

      expect(onSpy).toHaveBeenCalledWith(event, expect.any(Function));

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("does not register the listener on the client", () => {
      const eventsRegistryInstance = buildRegistryFor(false);

      eventsRegistryInstance[method]({}, "handler", { name: "resourceA" } as never, ProviderA, handlerInvoker);

      expect(onSpy).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ["registerClientResourceStartEventListener", "onClientResourceStart"] as const,
    ["registerClientResourceStopEventListener", "onClientResourceStop"] as const,
  ])("%s (client-only)", (method, event) => {
    it("registers the listener and does not warn on the client", () => {
      const eventsRegistryInstance = buildRegistryFor(false);

      eventsRegistryInstance[method]({}, "handler", { name: "resourceA" } as never, ProviderA, handlerInvoker);

      expect(onSpy).toHaveBeenCalledWith(event, expect.any(Function));

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("does not register the listener on the server", () => {
      const eventsRegistryInstance = buildRegistryFor(true);

      eventsRegistryInstance[method]({}, "handler", { name: "resourceA" } as never, ProviderA, handlerInvoker);

      expect(onSpy).not.toHaveBeenCalled();
    });
  });
});
