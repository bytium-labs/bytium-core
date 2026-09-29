import "reflect-metadata";
import { BytiumServerExecutionContext } from "@citizenfx/types/bytium-server-execution-context.type";
import { BytiumClientExecutionContext } from "@citizenfx/types/bytium-client-execution-context.type";
import { KeyBindStateEnum } from "@citizenfx/enums/key-bind-state.enum";

declare module "@citizenfx/interfaces/bytium-client-execution-context-map.interface" {
  interface BytiumClientExecutionContextMap {
    testZoneEnter: { zoneId: number };
  }
}

describe("Execution context types", () => {
  it("should expose source on a server netCallback context and carry the shared base fields", () => {
    const serverContext: BytiumServerExecutionContext = {
      type: "NET_CALLBACK",
      provider: {},
      methodName: "handle",
      source: 5,
      args: ["payload"],
    };

    expect(serverContext.type).toBe("NET_CALLBACK");

    if (serverContext.type === "NET_CALLBACK") {
      expect(serverContext.source).toBe(5);
    }
  });

  it("should NOT allow a client-only surface like keyBind on a server context", () => {
    const clientOnlySurface: BytiumClientExecutionContext = {
      type: "KEY_BIND",
      provider: {},
      methodName: "handle",
      state: KeyBindStateEnum.PRESSED,
    };
    // @ts-expect-error keyBind is a client-only surface and must not be assignable to a server context.
    const serverContext: BytiumServerExecutionContext = clientOnlySurface;

    expect(serverContext.type).toBe("KEY_BIND");
  });

  it("should omit source from a client netCallback context", () => {
    const clientContext: BytiumClientExecutionContext = {
      type: "NET_CALLBACK",
      provider: {},
      methodName: "handle",
      args: ["payload"],
    };

    expect(clientContext.type).toBe("NET_CALLBACK");

    if (clientContext.type === "NET_CALLBACK") {
      // @ts-expect-error source is server-only and absent from the client netCallback context.
      expect(clientContext.source).toBeUndefined();
    }
  });

  it("should narrow a keyBind context to its state payload on the client", () => {
    const clientContext: BytiumClientExecutionContext = {
      type: "KEY_BIND",
      provider: {},
      methodName: "onKey",
      state: KeyBindStateEnum.HELD,
    };

    if (clientContext.type === "KEY_BIND") {
      expect(clientContext.state).toBe(KeyBindStateEnum.HELD);
    }
  });

  it("should fold a module-augmented client surface into the client context union", () => {
    const augmentedContext: BytiumClientExecutionContext = {
      type: "testZoneEnter",
      provider: {},
      methodName: "onZone",
      zoneId: 42,
    };

    if (augmentedContext.type === "testZoneEnter") {
      expect(augmentedContext.zoneId).toBe(42);
    }
  });
});
