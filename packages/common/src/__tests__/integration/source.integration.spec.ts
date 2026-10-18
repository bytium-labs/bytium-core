import "reflect-metadata";
import { HandlerInvoker } from "@core";
import { RawSource, Source } from "@citizenfx";
import { EventsRegistry } from "@citizenfx/registries/events.registry";
import { InvocationContextInterface } from "@invocation/interfaces/invocation-context.interface";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";

describe("Source of an event handler invocation", () => {
  let capturedOnListener: ((...args: unknown[]) => void) | undefined;
  let capturedOnNetListener: ((...args: unknown[]) => void) | undefined;
  const flush = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
  };

  class DependentProviderA {
    source: unknown;
    rawSource: unknown;
    context: InvocationContextInterface | undefined;

    handle(@Source() source: string, @RawSource() rawSource: unknown) {
      this.source = source;
      this.rawSource = rawSource;
      this.context = invocationContextManagerInstance.getContext();
    }
  }

  beforeAll(() => {
    jest.spyOn(globalThis, "IsDuplicityVersion").mockReturnValue(true);
    jest.spyOn(globalThis, "on").mockImplementation((_name, listener) => {
      capturedOnListener = listener as (...args: unknown[]) => void;
    });
    jest.spyOn(globalThis, "onNet").mockImplementation((_name, listener) => {
      capturedOnNetListener = listener as (...args: unknown[]) => void;
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
    globalThis.source = 0;
  });

  describe.each([
    ["@OnEvent", "registerEventListener", () => capturedOnListener] as const,
    ["@OnNetEvent", "registerNetEventListener", () => capturedOnNetListener] as const,
  ])("%s handler", (_label, registerMethod, getListener) => {
    describe.each([
      ["a player", 42, "42"],
      ["the server console", 0, "0"],
      ["a plain emit", "script", "script"],
      ["a plain emit outside FiveM Enhanced", "", ""],
    ] as const)("triggered by %s", (_origin, rawSource, expectedSource) => {
      it("should receive the source as a string and the raw source unchanged", async () => {
        const dependentProviderAInstance = new DependentProviderA();

        new EventsRegistry()[registerMethod](
          dependentProviderAInstance,
          "handle",
          { name: "resource:module:event" },
          DependentProviderA,
          new HandlerInvoker(),
        );

        Reflect.set(globalThis, "source", rawSource);
        getListener()!();
        await flush();

        expect(dependentProviderAInstance.source).toBe(expectedSource);
        expect(dependentProviderAInstance.rawSource).toBe(rawSource);
        expect(dependentProviderAInstance.context?.source).toBe(expectedSource);
      });
    });
  });
});
