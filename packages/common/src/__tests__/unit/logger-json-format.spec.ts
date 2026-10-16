import { LogLevelEnum } from "@logger/enums/log-level.enum";

type LoggerModule = typeof import("@logger/logger");
type InvocationModule = typeof import("@invocation/managers/invocation-context.manager");
type SharedConstsModule = typeof import("@shared/consts/log-masked-errors.const");

describe("Logger json format", () => {
  let logSpy: jest.SpyInstance;
  let getConvarSpy: jest.SpyInstance<string, [string, string]>;
  let isDuplicityVersionSpy: jest.SpyInstance<boolean, []>;
  const withFormat = (
    format: string | undefined,
    run: (modules: LoggerModule & InvocationModule & SharedConstsModule) => void,
  ): void => {
    getConvarSpy.mockImplementation((key: string, defaultValue: string) =>
      format !== undefined && key.includes("bytium-core:logFormat") ? format : defaultValue,
    );
    isDuplicityVersionSpy.mockReturnValue(true);

    jest.isolateModules(() => {
      const loggerModule = jest.requireActual("@logger/logger");
      const invocationModule = jest.requireActual("@invocation/managers/invocation-context.manager");
      const sharedConstsModule = jest.requireActual("@shared/consts/log-masked-errors.const");

      run({ ...loggerModule, ...invocationModule, ...sharedConstsModule });
    });
  };
  const lastLine = (): Record<string, unknown> => JSON.parse(logSpy.mock.calls[logSpy.mock.calls.length - 1][0]);

  beforeAll(() => {
    getConvarSpy = jest.spyOn(globalThis, "GetConvar");
    isDuplicityVersionSpy = jest.spyOn(globalThis, "IsDuplicityVersion");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    getConvarSpy.mockImplementation((_key: string, defaultValue: string) => defaultValue);
    isDuplicityVersionSpy.mockReturnValue(false);
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

  it("should decompose the first error with its stack inside, keeping payload for data", () => {
    withFormat("json", ({ Logger }) => {
      const failure = new Error("boom");

      new Logger("test", [LogLevelEnum.ERROR]).error("failed", failure, { principal: "group.admin" });
    });

    const entry = lastLine();
    const error = entry.error as Record<string, unknown>;

    expect(error.name).toBe("Error");
    expect(error.message).toBe("boom");
    expect(typeof error.stack).toBe("string");
    expect(String(error.stack)).toContain("boom");

    expect(entry).not.toHaveProperty("stack");
    expect(entry.payload).toEqual([{ principal: "group.admin" }]);
  });

  it("should include the error's own fields in the decomposition", () => {
    withFormat("json", ({ Logger }) => {
      const failure = Object.assign(new Error("not found"), {
        code: "ENOENT",
        errors: { name: ["is required"] },
      });

      new Logger("test", [LogLevelEnum.ERROR]).error("failed", failure);
    });

    const error = lastLine().error as Record<string, unknown>;

    expect(error.code).toBe("ENOENT");
    expect(error.errors).toEqual({ name: ["is required"] });
  });

  it("should stringify an error field that cannot be serialized instead of dropping the line", () => {
    withFormat("json", ({ Logger }) => {
      const circular: Record<string, unknown> = {};

      circular.self = circular;

      new Logger("test", [LogLevelEnum.ERROR]).error("failed", Object.assign(new Error("boom"), { details: circular }));
    });

    const error = lastLine().error as Record<string, unknown>;

    expect(typeof error.details).toBe("string");
  });

  it("should log the scrubbed errors copy instead of the original when the error carries one", () => {
    withFormat("json", ({ Logger, LOG_MASKED_ERRORS }) => {
      const failure = Object.assign(new Error("Validation failed"), {
        errors: { login: ["must be at least 3 characters"], password: ['Expected string but received "hunter2"'] },
      });

      Object.defineProperty(failure, LOG_MASKED_ERRORS, {
        value: { login: ["must be at least 3 characters"], password: ['Expected string but received "[REDACTED]"'] },
      });
      new Logger("test", [LogLevelEnum.ERROR]).error("failed", failure);

      expect(Reflect.get(failure, "errors")).toEqual({
        login: ["must be at least 3 characters"],
        password: ['Expected string but received "hunter2"'],
      });
    });

    const error = lastLine().error as Record<string, unknown>;

    expect(error.errors).toEqual({
      login: ["must be at least 3 characters"],
      password: ['Expected string but received "[REDACTED]"'],
    });
  });

  it("should decompose the error's cause into error.cause and chain its stack", () => {
    withFormat("json", ({ Logger }) => {
      const original = new TypeError("the real reason");
      const wrapper = new Error("contextful wrapper", { cause: original });

      new Logger("test", [LogLevelEnum.ERROR]).error("failed", wrapper);
    });

    const error = lastLine().error as Record<string, unknown>;

    expect(error.cause).toEqual({ name: "TypeError", message: "the real reason" });
    expect(String(error.stack)).toContain("contextful wrapper");
    expect(String(error.stack)).toContain("Caused by: TypeError: the real reason");
  });

  it("should keep additional errors in the payload in their full shape", () => {
    withFormat("json", ({ Logger }) => {
      new Logger("test", [LogLevelEnum.ERROR]).error("failed twice", new TypeError("first"), new RangeError("second"));
    });

    const entry = lastLine();
    const error = entry.error as Record<string, unknown>;

    expect(error.name).toBe("TypeError");
    expect(error.message).toBe("first");

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

  it("should spread assigned __bytiumMetadata buckets as top-level fields", () => {
    withFormat("json", ({ Logger, invocationContextManagerInstance }) => {
      invocationContextManagerInstance.run(
        () => ({
          correlationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f",
          type: "HTTP",
          handler: "PlayersController.create",
          __bytiumMetadata: { request: { method: "POST", path: "/players" } },
        }),
        () => {
          new Logger("test", [LogLevelEnum.INFO]).log("player created");
        },
      );
    });

    const entry = lastLine();

    expect(entry.request).toEqual({ method: "POST", path: "/players" });
    expect(entry).not.toHaveProperty("__bytiumMetadata");
  });

  it("should not attach captured handler args to regular lines", () => {
    withFormat("json", ({ Logger, invocationContextManagerInstance }) => {
      invocationContextManagerInstance.run(
        () => ({
          correlationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f",
          type: "COMMAND",
          handler: "LoginCommand.login",
          __bytiumHandlerArgs: ["lilabyte", "[REDACTED]"],
        }),
        () => {
          new Logger("test", [LogLevelEnum.INFO]).log("inside handler");
        },
      );
    });

    const entry = lastLine();

    expect(entry).not.toHaveProperty("__bytiumHandlerArgs");
    expect(entry).not.toHaveProperty("args");
  });

  it("should attach captured handler args as a top-level field on error lines", () => {
    withFormat("json", ({ Logger, invocationContextManagerInstance }) => {
      invocationContextManagerInstance.run(
        () => ({
          correlationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f",
          type: "COMMAND",
          handler: "LoginCommand.login",
          __bytiumHandlerArgs: ["lilabyte", "[REDACTED]"],
        }),
        () => {
          new Logger("test", [LogLevelEnum.ERROR]).error("failed", new Error("wrong password"));
        },
      );
    });

    const entry = lastLine();

    expect(entry.args).toEqual(["lilabyte", "[REDACTED]"]);
    expect(entry).not.toHaveProperty("__bytiumHandlerArgs");
  });

  it("should print the scrubbed errors copy in pretty mode without touching the original", () => {
    let failure: Error | undefined;

    withFormat(undefined, ({ Logger, LOG_MASKED_ERRORS }) => {
      failure = Object.assign(new Error("Validation failed"), {
        errors: { password: ['received "hunter2"'] },
      });

      Object.defineProperty(failure, LOG_MASKED_ERRORS, { value: { password: ["[REDACTED]"] } });
      new Logger("test", [LogLevelEnum.ERROR]).error("failed", failure);
    });

    const printed = logSpy.mock.calls[0][1] as Error & { errors: Record<string, string[]> };

    expect(printed).toBeInstanceOf(Error);
    expect(printed.message).toBe("Validation failed");
    expect(printed.errors).toEqual({ password: ["[REDACTED]"] });

    expect(Reflect.get(failure!, "errors")).toEqual({ password: ['received "hunter2"'] });
  });

  it("should append the cause explicitly in pretty mode", () => {
    withFormat(undefined, ({ Logger }) => {
      const original = new TypeError("the real reason");

      new Logger("test", [LogLevelEnum.ERROR]).error("failed", new Error("wrapper", { cause: original }));
    });

    const call = logSpy.mock.calls[0];

    expect(call[2]).toBe("\nCaused by:");
    expect(call[3]).toBeInstanceOf(TypeError);
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
