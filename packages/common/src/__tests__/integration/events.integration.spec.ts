import { EventsRegistry } from "@citizenfx/registries/events.registry";
import { HandlerInvoker } from "@core/invokers/handler.invoker";
import { Logger } from "@logger";

class ProviderA {}

describe("EventsRegistry environment guards", () => {
  const handlerInvoker = {} as HandlerInvoker;
  let onMock: jest.Mock;
  let warnSpy: jest.SpyInstance;
  const buildRegistryFor = (isServer: boolean): EventsRegistry => {
    (global as unknown as { IsDuplicityVersion: () => boolean }).IsDuplicityVersion = () => isServer;

    return new EventsRegistry();
  };

  beforeEach(() => {
    onMock = jest.fn();
    (global as unknown as { on: unknown }).on = onMock;
    warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    (global as unknown as { IsDuplicityVersion: () => boolean }).IsDuplicityVersion = () => false;
  });

  describe.each([
    ["registerServerResourceStartEventListener", "onServerResourceStart"] as const,
    ["registerServerResourceStopEventListener", "onServerResourceStop"] as const,
  ])("%s (server-only)", (method, event) => {
    it("registers the listener and does not warn on the server", () => {
      const eventsRegistryInstance = buildRegistryFor(true);

      eventsRegistryInstance[method]({}, "handler", { name: "resourceA" } as never, ProviderA, handlerInvoker);

      expect(onMock).toHaveBeenCalledWith(event, expect.any(Function));

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("does not register the listener on the client", () => {
      const eventsRegistryInstance = buildRegistryFor(false);

      eventsRegistryInstance[method]({}, "handler", { name: "resourceA" } as never, ProviderA, handlerInvoker);

      expect(onMock).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ["registerClientResourceStartEventListener", "onClientResourceStart"] as const,
    ["registerClientResourceStopEventListener", "onClientResourceStop"] as const,
  ])("%s (client-only)", (method, event) => {
    it("registers the listener and does not warn on the client", () => {
      const eventsRegistryInstance = buildRegistryFor(false);

      eventsRegistryInstance[method]({}, "handler", { name: "resourceA" } as never, ProviderA, handlerInvoker);

      expect(onMock).toHaveBeenCalledWith(event, expect.any(Function));

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("does not register the listener on the server", () => {
      const eventsRegistryInstance = buildRegistryFor(true);

      eventsRegistryInstance[method]({}, "handler", { name: "resourceA" } as never, ProviderA, handlerInvoker);

      expect(onMock).not.toHaveBeenCalled();
    });
  });
});
