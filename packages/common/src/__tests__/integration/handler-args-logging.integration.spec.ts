import "reflect-metadata";
import { Sensitive } from "@citizenfx/decorators/shared/sensitive.decorator";
import { ParamDecoratorEntryInterface } from "@core/interfaces/param-decorator-entry.interface";
import { sensitive } from "@core/utils/sensitive-schema.utils";
import { BytiumMetadataEnum, ConstructorType } from "@shared";

interface IsolatedModules {
  HandlerInvoker: typeof import("@core/invokers/handler.invoker").HandlerInvoker;
  invocationContextManagerInstance: typeof import("@invocation/managers/invocation-context.manager").invocationContextManagerInstance;
  CommandsRegistry: typeof import("@citizenfx/registries/commands.registry").CommandsRegistry;
}

describe("Handler args logging", () => {
  let getConvarSpy: jest.SpyInstance<string, [string, string]>;
  let registerCommandSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  const jsonLines = (): Record<string, unknown>[] =>
    logSpy.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line) as Record<string, unknown>);

  beforeAll(() => {
    jest.spyOn(globalThis, "IsDuplicityVersion").mockReturnValue(true);
    getConvarSpy = jest.spyOn(globalThis, "GetConvar");
    registerCommandSpy = jest.spyOn(globalThis, "RegisterCommand");
    jest.spyOn(globalThis, "GetRegisteredCommands").mockReturnValue([]);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    registerCommandSpy.mockClear();
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  const withMode = (mode: string | undefined): IsolatedModules => {
    getConvarSpy.mockImplementation((key: string, defaultValue: string) => {
      if (key.includes("bytium-core:logFormat")) return "JSON";

      if (mode !== undefined && key.includes("bytium-core:logHandlerArgs")) return mode;

      return defaultValue;
    });

    let modules: IsolatedModules | undefined;

    jest.isolateModules(() => {
      modules = {
        HandlerInvoker: jest.requireActual("@core/invokers/handler.invoker").HandlerInvoker,
        invocationContextManagerInstance: jest.requireActual("@invocation/managers/invocation-context.manager")
          .invocationContextManagerInstance,
        CommandsRegistry: jest.requireActual("@citizenfx/registries/commands.registry").CommandsRegistry,
      };
    });

    return modules!;
  };
  const stampParamDecorators = (
    target: ConstructorType,
    methodName: string,
    entries: (ParamDecoratorEntryInterface | undefined)[],
  ): void => {
    Reflect.defineMetadata(BytiumMetadataEnum.PARAM_DECORATORS, entries, target.prototype, methodName);
  };
  const declareLoginCommand = () => {
    class LoginCommand {
      capturedArgs: unknown;

      login(login: string, password: string) {
        return `${login}:${password}`;
      }
    }

    stampParamDecorators(LoginCommand, "login", [
      { factory: () => "lilabyte", data: undefined },
      { factory: () => "hunter2", data: undefined },
    ]);
    Sensitive()(LoginCommand.prototype, "login", 1);

    return LoginCommand;
  };

  it("should log an Invoking line with the args top-level and sensitive positions redacted in ALL mode", async () => {
    const { HandlerInvoker } = withMode("ALL");
    const LoginCommand = declareLoginCommand();

    await new HandlerInvoker().invoke({ type: "COMMAND", provider: new LoginCommand(), methodName: "login" });

    const invokingLine = jsonLines().find((line) => line.message === "Invoking LoginCommand.login");

    expect(invokingLine).toBeDefined();
    expect(invokingLine?.args).toEqual(["lilabyte", "[REDACTED]"]);
    expect(invokingLine).not.toHaveProperty("payload");
  });

  it("should skip the args capture when the boundary opts out", async () => {
    const { HandlerInvoker, invocationContextManagerInstance } = withMode("ALL");
    const LoginCommand = declareLoginCommand();
    const loginCommandInstance = new LoginCommand();

    LoginCommand.prototype.login = function (this: InstanceType<typeof LoginCommand>) {
      this.capturedArgs = invocationContextManagerInstance.getContext()?.__bytiumHandlerArgs;

      return "ok";
    };

    await new HandlerInvoker().invoke({
      type: "HTTP",
      provider: loginCommandInstance,
      methodName: "login",
      skipArgsLog: true,
    });

    expect(loginCommandInstance.capturedArgs).toBeUndefined();

    expect(jsonLines().find((line) => String(line.message).startsWith("Invoking"))).toBeUndefined();
  });

  it("should mask the paths declared by a sensitive schema wrapper", async () => {
    const { HandlerInvoker } = withMode("ALL");
    const bodySchema = sensitive(
      { "~standard": { version: 1, vendor: "test", validate: (value: unknown) => ({ value }) } },
      ["password"],
    );

    class AccountController {
      create(_dto: object) {
        return "ok";
      }
    }

    stampParamDecorators(AccountController, "create", [
      { factory: () => ({ login: "lilabyte", password: "hunter2" }), data: undefined, pipes: [bodySchema] },
    ]);

    await new HandlerInvoker().invoke({
      type: "NET_CALLBACK",
      provider: new AccountController(),
      methodName: "create",
    });

    const invokingLine = jsonLines().find((line) => line.message === "Invoking AccountController.create");

    expect(invokingLine?.args).toEqual([{ login: "lilabyte", password: "[REDACTED]" }]);
  });

  it("should mask the paths declared by a callable sensitive schema", async () => {
    const { HandlerInvoker } = withMode("ALL");
    const callableSchema = Object.assign((value: unknown) => value, {
      "~standard": { version: 1 as const, vendor: "arktype", validate: (value: unknown) => ({ value }) },
    });
    const bodySchema = sensitive(callableSchema as never, ["password"]);

    class AccountsController {
      create(_dto: object) {
        return "ok";
      }
    }

    stampParamDecorators(AccountsController, "create", [
      { factory: () => ({ login: "lilabyte", password: "hunter2" }), data: undefined, pipes: [bodySchema] },
    ]);

    await new HandlerInvoker().invoke({
      type: "NET_CALLBACK",
      provider: new AccountsController(),
      methodName: "create",
    });

    const invokingLine = jsonLines().find((line) => line.message === "Invoking AccountsController.create");

    expect(invokingLine?.args).toEqual([{ login: "lilabyte", password: "[REDACTED]" }]);
  });

  it("should expose the captured args on the invocation context in ERRORS mode without logging a line", async () => {
    const { HandlerInvoker, invocationContextManagerInstance } = withMode("errors");
    const LoginCommand = declareLoginCommand();
    const loginCommandInstance = new LoginCommand();

    LoginCommand.prototype.login = function (this: InstanceType<typeof LoginCommand>) {
      this.capturedArgs = invocationContextManagerInstance.getContext()?.__bytiumHandlerArgs;

      return "ok";
    };

    await new HandlerInvoker().invoke({ type: "COMMAND", provider: loginCommandInstance, methodName: "login" });

    expect(loginCommandInstance.capturedArgs).toEqual(["lilabyte", "[REDACTED]"]);

    expect(jsonLines().find((line) => String(line.message).startsWith("Invoking"))).toBeUndefined();
  });

  it("should capture nothing when the mode is OFF", async () => {
    const { HandlerInvoker, invocationContextManagerInstance } = withMode(undefined);
    const LoginCommand = declareLoginCommand();
    const loginCommandInstance = new LoginCommand();

    LoginCommand.prototype.login = function (this: InstanceType<typeof LoginCommand>) {
      this.capturedArgs = invocationContextManagerInstance.getContext()?.__bytiumHandlerArgs;

      return "ok";
    };

    await new HandlerInvoker().invoke({ type: "COMMAND", provider: loginCommandInstance, methodName: "login" });

    expect(loginCommandInstance.capturedArgs).toBeUndefined();
  });

  it("should attach the captured args to the command boundary error line", async () => {
    const { HandlerInvoker, CommandsRegistry } = withMode("ERRORS");
    const LoginCommand = declareLoginCommand();

    LoginCommand.prototype.login = () => {
      throw new Error("wrong password");
    };

    new CommandsRegistry().registerCommand(
      new LoginCommand(),
      "login",
      { name: "login", canBeUsedByServer: true },
      LoginCommand,
      new HandlerInvoker(),
    );

    const commandHandleWrapper = registerCommandSpy.mock.calls[0][1];

    await commandHandleWrapper(0, [], "login");

    const errorLine = jsonLines().find((line) => String(line.message).includes("Error while handling @Command"));

    expect(errorLine).toBeDefined();
    expect(errorLine?.args).toEqual(["lilabyte", "[REDACTED]"]);
    expect((errorLine?.error as Record<string, unknown>)?.message).toBe("wrong password");
  });
});
