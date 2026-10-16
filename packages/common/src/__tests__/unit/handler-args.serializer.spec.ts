import { HandlerArgsSerializer } from "@invocation/serializers/handler-args.serializer";
import { SensitiveMaskType } from "@invocation/types/sensitive-mask.type";

describe("HandlerArgsSerializer", () => {
  const noMasks = new Map<number, SensitiveMaskType>();

  it("should redact the whole value of a position masked with true", () => {
    const serialized = HandlerArgsSerializer.serialize(
      ["lilabyte", "hunter2"],
      new Map<number, SensitiveMaskType>([[1, true]]),
    );

    expect(serialized).toEqual(["lilabyte", "[REDACTED]"]);
  });

  it("should redact only the listed dot paths of a position masked with paths", () => {
    const serialized = HandlerArgsSerializer.serialize(
      [{ login: "lilabyte", password: "hunter2", credentials: { token: "secret", scope: "all" } }],
      new Map<number, SensitiveMaskType>([[0, ["password", "credentials.token"]]]),
    );

    expect(serialized).toEqual([
      { login: "lilabyte", password: "[REDACTED]", credentials: { token: "[REDACTED]", scope: "all" } },
    ]);
  });

  it("should mask a wildcard path across array elements", () => {
    const serialized = HandlerArgsSerializer.serialize(
      [
        {
          items: [
            { token: "a", id: 1 },
            { token: "b", id: 2 },
          ],
        },
      ],
      new Map<number, SensitiveMaskType>([[0, ["items.*.token"]]]),
    );

    expect(serialized).toEqual([
      {
        items: [
          { token: "[REDACTED]", id: 1 },
          { token: "[REDACTED]", id: 2 },
        ],
      },
    ]);
  });

  it("should mask a leading wildcard across every top-level key", () => {
    const serialized = HandlerArgsSerializer.serialize(
      [{ discord: { secret: "a", id: 1 }, steam: { secret: "b" } }],
      new Map<number, SensitiveMaskType>([[0, ["*.secret"]]]),
    );

    expect(serialized).toEqual([{ discord: { secret: "[REDACTED]", id: 1 }, steam: { secret: "[REDACTED]" } }]);
  });

  it("should mask whole array elements when the wildcard is the leaf", () => {
    const serialized = HandlerArgsSerializer.serialize(
      [{ tokens: ["a", "b"] }],
      new Map<number, SensitiveMaskType>([[0, ["tokens.*"]]]),
    );

    expect(serialized).toEqual([{ tokens: ["[REDACTED]", "[REDACTED]"] }]);
  });

  it("should leave the value untouched when a masked path does not exist", () => {
    const serialized = HandlerArgsSerializer.serialize(
      [{ login: "lilabyte" }],
      new Map<number, SensitiveMaskType>([[0, ["password", "nested.deep.token"]]]),
    );

    expect(serialized).toEqual([{ login: "lilabyte" }]);
  });

  it("should keep small serializable values in their original shape", () => {
    const serialized = HandlerArgsSerializer.serialize([42, "name", { nested: { ok: true } }], noMasks);

    expect(serialized).toEqual([42, "name", { nested: { ok: true } }]);
  });

  it("should snapshot objects so later mutations do not leak into the captured args", () => {
    const argument = { balance: 100 };
    const serialized = HandlerArgsSerializer.serialize([argument], noMasks);

    argument.balance = 999;

    expect(serialized).toEqual([{ balance: 100 }]);
  });

  it("should mask paths on the snapshot without touching the original value", () => {
    const argument = { password: "hunter2" };

    HandlerArgsSerializer.serialize([argument], new Map<number, SensitiveMaskType>([[0, ["password"]]]));

    expect(argument.password).toBe("hunter2");
  });

  it("should reduce an error argument to its name and message", () => {
    const serialized = HandlerArgsSerializer.serialize([new TypeError("boom")], noMasks);

    expect(serialized).toEqual([{ name: "TypeError", message: "boom" }]);
  });

  it("should replace a class instance with a placeholder instead of dumping its internals", () => {
    class HttpRequest {
      private readonly headers = { authorization: "Bearer secret-token" };
    }

    expect(HandlerArgsSerializer.serialize([new HttpRequest()], noMasks)).toEqual(["[HttpRequest]"]);
  });

  it("should replace class instances nested inside plain data", () => {
    class HttpResponse {
      private readonly headers = { "set-cookie": "session=secret" };
    }

    const serialized = HandlerArgsSerializer.serialize([{ response: new HttpResponse(), ok: true }], noMasks);

    expect(serialized).toEqual([{ response: "[HttpResponse]", ok: true }]);
  });

  it("should keep a date argument as its ISO string", () => {
    const serialized = HandlerArgsSerializer.serialize([new Date("2026-10-14T00:00:00.000Z")], noMasks);

    expect(serialized).toEqual(["2026-10-14T00:00:00.000Z"]);
  });

  it("should mask paths before capping so a truncated argument never leaks a masked value", () => {
    const serialized = HandlerArgsSerializer.serialize(
      [{ password: "hunter2", padding: "x".repeat(5000) }],
      new Map<number, SensitiveMaskType>([[0, ["password"]]]),
    );
    const value = serialized[0] as string;

    expect(typeof value).toBe("string");
    expect(value.endsWith("...[truncated]")).toBe(true);
    expect(value).toContain("[REDACTED]");
    expect(value).not.toContain("hunter2");
  });

  it("should truncate an argument whose serialized form exceeds the cap", () => {
    const serialized = HandlerArgsSerializer.serialize(["x".repeat(5000)], noMasks);
    const value = serialized[0] as string;

    expect(value.endsWith("...[truncated]")).toBe(true);
    expect(value.length).toBeLessThan(1100);
  });

  it("should fall back to a string for a value that cannot be serialized", () => {
    const circular: Record<string, unknown> = {};

    circular.self = circular;

    expect(typeof HandlerArgsSerializer.serialize([circular], noMasks)[0]).toBe("string");
  });
});
