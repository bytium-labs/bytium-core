import { LogLevelEnum } from "@logger/enums/log-level.enum";

type LoggerModule = typeof import("@logger/logger");
type InvocationModule = typeof import("@invocation/managers/invocation-context.manager");

describe("Logger json format", () => {
  let logSpy: jest.SpyInstance;
  const withFormat = (format: string | undefined, run: (modules: LoggerModule & InvocationModule) => void): void => {
    (global as any).GetConvar = (key: string, defaultValue: string) =>
      format !== undefined && key.includes("bytium-core:logFormat") ? format : defaultValue;
    (global as any).IsDuplicityVersion = () => true;

    jest.isolateModules(() => {
      const loggerModule = jest.requireActual("@logger/logger");
      const invocationModule = jest.requireActual("@invocation/managers/invocation-context.manager");

      run({ ...loggerModule, ...invocationModule });
    });
  };
  const lastLine = (): Record<string, unknown> => JSON.parse(logSpy.mock.calls[logSpy.mock.calls.length - 1][0]);

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    (global as any).GetConvar = (_key: string, defaultValue: string) => defaultValue;
    (global as any).IsDuplicityVersion = () => false;
  });

  it("should emit a single json line with timestamp, level, resource, context and message", () => {
    withFormat("json", ({ Logger }) => {
      new Logger("AcesRegistry", [LogLevelEnum.WARN]).warn("something odd");
    });

    const entry = lastLine();

    expect(entry.level).toBe("warn");
    expect(entry.resource).toBe("test-resource");
    expect(entry.context).toBe("AcesRegistry");
    expect(entry.message).toBe("something odd");
    expect(typeof entry.timestamp).toBe("number");
  });

  it("should strip color codes from the message", () => {
    withFormat("json", ({ Logger }) => {
      new Logger("test", [LogLevelEnum.INFO]).log("^1broken^7 but ^3recovering^7");
    });

    expect(lastLine().message).toBe("broken but recovering");
  });

  it("should decompose the first error into the error and stack fields, keeping payload for data", () => {
    withFormat("json", ({ Logger }) => {
      const failure = new Error("boom");

      new Logger("test", [LogLevelEnum.ERROR]).error("failed", failure, { principal: "group.admin" });
    });

    const entry = lastLine();

    expect(entry.error).toEqual({ name: "Error", message: "boom" });
    expect(typeof entry.stack).toBe("string");
    expect(entry.stack).toContain("boom");
    expect(entry.payload).toEqual([{ principal: "group.admin" }]);
  });

  it("should keep additional errors in the payload in their full shape", () => {
    withFormat("json", ({ Logger }) => {
      new Logger("test", [LogLevelEnum.ERROR]).error("failed twice", new TypeError("first"), new RangeError("second"));
    });

    const entry = lastLine();

    expect(entry.error).toEqual({ name: "TypeError", message: "first" });

    const payload = entry.payload as Record<string, unknown>[];

    expect(payload).toHaveLength(1);
    expect(payload[0].name).toBe("RangeError");
    expect(payload[0].message).toBe("second");
    expect(typeof payload[0].stack).toBe("string");
  });

  it("should omit the error and stack fields when no error is logged", () => {
    withFormat("json", ({ Logger }) => {
      new Logger("test", [LogLevelEnum.INFO]).log("all good", { detail: 1 });
    });

    const entry = lastLine();

    expect(entry).not.toHaveProperty("error");
    expect(entry).not.toHaveProperty("stack");
  });

  it("should fall back to a string for a param that cannot be serialized", () => {
    withFormat("json", ({ Logger }) => {
      const circular: Record<string, unknown> = {};

      circular.self = circular;

      new Logger("test", [LogLevelEnum.INFO]).log("with circular", circular);
    });

    expect(typeof (lastLine().payload as unknown[])[0]).toBe("string");
  });

  it("should coerce a non-string message instead of throwing", () => {
    withFormat("json", ({ Logger }) => {
      new Logger("test", [LogLevelEnum.INFO]).log({ not: "a string" } as unknown as string);
    });

    expect(typeof lastLine().message).toBe("string");
  });

  it("should omit the payload field when only a message is logged", () => {
    withFormat("json", ({ Logger }) => {
      new Logger("test", [LogLevelEnum.INFO]).log("bare message");
    });

    expect(lastLine()).not.toHaveProperty("payload");
  });

  it("should include invocation fields when an invocation context is active", () => {
    withFormat("json", ({ Logger, invocationContextManagerInstance }) => {
      invocationContextManagerInstance.run(
        () => ({
          correlationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f",
          type: "COMMAND",
          handler: "TestCommand.run",
          source: 42,
        }),
        () => {
          new Logger("test", [LogLevelEnum.INFO]).log("inside handler");
        },
      );
    });

    const entry = lastLine();

    expect(entry.correlationId).toBe("0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f");
    expect(entry.type).toBe("COMMAND");
    expect(entry.handler).toBe("TestCommand.run");
    expect(entry.source).toBe(42);
  });

  it("should keep the pretty output unchanged when the format convar is unset", () => {
    withFormat(undefined, ({ Logger }) => {
      new Logger("test", [LogLevelEnum.WARN]).warn("plain warning", { detail: 1 });
    });

    expect(logSpy).toHaveBeenCalledWith("^3[test] plain warning", { detail: 1 }, "^7");
  });

  it("should fall back to pretty for an unknown format value", () => {
    withFormat("yaml", ({ Logger }) => {
      new Logger("test", [LogLevelEnum.INFO]).log("message");
    });

    expect(logSpy.mock.calls[0][0]).toContain("[test] message");
  });
});
