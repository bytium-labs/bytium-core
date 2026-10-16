import { InvalidArgumentException } from "@core/exceptions/invalid-argument.exception";
import { InvocationContext } from "@invocation/contexts/invocation.context";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";

describe("InvocationContext", () => {
  beforeAll(() => {
    jest.spyOn(globalThis, "IsDuplicityVersion").mockReturnValue(true);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const runInContext = <T>(callback: () => T): T =>
    invocationContextManagerInstance.run(
      () => ({ correlationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f", type: "COMMAND", handler: "TestCommand.run" }),
      callback,
    );

  describe("current", () => {
    it("should return undefined outside an invocation", () => {
      expect(InvocationContext.current()).toBeUndefined();
    });

    it("should return the active invocation context", () => {
      const context = runInContext(() => InvocationContext.current());

      expect(context?.correlationId).toBe("0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f");
      expect(context?.type).toBe("COMMAND");
      expect(context?.handler).toBe("TestCommand.run");
    });

    it("should return a snapshot that does not leak mutations back into the context", () => {
      runInContext(() => {
        InvocationContext.assign("player", { id: 42 });

        const snapshot = InvocationContext.current();

        snapshot!.correlationId = "forged";
        Reflect.set(snapshot!.__bytiumMetadata!.player, "id", 999);

        const fresh = InvocationContext.current();

        expect(fresh?.correlationId).toBe("0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f");
        expect(fresh?.__bytiumMetadata?.player).toEqual({ id: 42 });
      });
    });

    it("should omit the __bytiumMetadata field when nothing was assigned", () => {
      const context = runInContext(() => InvocationContext.current());

      expect(context).not.toHaveProperty("__bytiumMetadata");
    });
  });

  describe("assign", () => {
    it("should merge fields into the same bucket across calls", () => {
      runInContext(() => {
        InvocationContext.assign("trade", { id: 7 });
        InvocationContext.assign("trade", { price: 100 });

        expect(InvocationContext.current()?.__bytiumMetadata?.trade).toEqual({ id: 7, price: 100 });
      });
    });

    it("should keep separate buckets independent", () => {
      runInContext(() => {
        InvocationContext.assign("trade", { id: 7 });
        InvocationContext.assign("player", { id: 42 });

        expect(InvocationContext.current()?.__bytiumMetadata).toEqual({
          trade: { id: 7 },
          player: { id: 42 },
        });
      });
    });

    it("should return true when an invocation context is active", () => {
      expect(runInContext(() => InvocationContext.assign("player", { id: 42 }))).toBe(true);
    });

    it("should return false outside an invocation", () => {
      expect(InvocationContext.assign("player", { id: 42 })).toBe(false);
    });

    it("should throw for a bucket name reserved by a framework field", () => {
      expect(() => InvocationContext.assign("error", { reason: "boom" })).toThrow(InvalidArgumentException);
      expect(() => InvocationContext.assign("correlationId", { forged: true })).toThrow(InvalidArgumentException);
    });

    it("should throw for an empty bucket name", () => {
      expect(() => InvocationContext.assign("", { reason: "boom" })).toThrow(InvalidArgumentException);
    });

    it("should throw for the boundary-line bucket names", () => {
      expect(() => InvocationContext.assign("request", { method: "GET" })).toThrow(InvalidArgumentException);
      expect(() => InvocationContext.assign("response", { statusCode: 200 })).toThrow(InvalidArgumentException);
    });
  });

  describe("scoped", () => {
    it("should expose the buckets only for the duration of the callback", () => {
      runInContext(() => {
        const insideMetadata = InvocationContext.scoped({ request: { method: "GET" } }, () => {
          return InvocationContext.current()?.__bytiumMetadata;
        });

        expect(insideMetadata).toEqual({ request: { method: "GET" } });

        expect(InvocationContext.current()).not.toHaveProperty("__bytiumMetadata");
      });
    });

    it("should merge scoped buckets on top of assigned ones", () => {
      runInContext(() => {
        InvocationContext.assign("player", { id: 42 });

        const insideMetadata = InvocationContext.scoped({ request: { method: "GET" } }, () => {
          return InvocationContext.current()?.__bytiumMetadata;
        });

        expect(insideMetadata).toEqual({ player: { id: 42 }, request: { method: "GET" } });

        expect(InvocationContext.current()?.__bytiumMetadata).toEqual({ player: { id: 42 } });
      });
    });

    it("should keep the correlationId of the surrounding invocation", () => {
      runInContext(() => {
        const insideCorrelationId = InvocationContext.scoped({ request: { method: "GET" } }, () => {
          return InvocationContext.current()?.correlationId;
        });

        expect(insideCorrelationId).toBe("0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f");
      });
    });

    it("should return the callback result", () => {
      expect(runInContext(() => InvocationContext.scoped({ request: {} }, () => "result"))).toBe("result");
    });

    it("should run the callback without a context when no invocation is active", () => {
      const insideContext = InvocationContext.scoped({ request: { method: "GET" } }, () => {
        return InvocationContext.current();
      });

      expect(insideContext).toBeUndefined();
    });

    it("should throw for a bucket name reserved by a framework field", () => {
      expect(() => InvocationContext.scoped({ payload: {} }, () => undefined)).toThrow(InvalidArgumentException);
    });
  });
});
