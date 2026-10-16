import "reflect-metadata";
import { HandlerInvoker } from "@core/invokers/handler.invoker";
import { CommandsRegistry } from "@citizenfx/registries/commands.registry";
import { EventsRegistry } from "@citizenfx/registries/events.registry";
import { CallbacksRegistry } from "@citizenfx/registries/callbacks.registry";
import { CronJobsRegistry } from "@citizenfx/registries/cron-jobs.registry";
import { transferableMarshalerInstance } from "@core/marshalers/transferable.marshaler";
import { boundaryLogManagerInstance } from "@invocation/managers/boundary-log.manager";
import { Logger } from "@logger";

describe("Boundary log lines", () => {
  let logSpy: jest.SpyInstance;
  const handlerInvoker = new HandlerInvoker();
  const loggedMessages = (): string[] => logSpy.mock.calls.map((call) => String(call[0]));
  const flush = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
  };

  beforeAll(() => {
    jest.spyOn(globalThis, "IsDuplicityVersion").mockReturnValue(true);
    jest.spyOn(globalThis, "GetInvokingResource").mockReturnValue("satellite-resource");
    jest.spyOn(globalThis, "on").mockImplementation(() => undefined);
    jest.spyOn(globalThis, "onNet").mockImplementation(() => undefined);
    jest.spyOn(globalThis, "emit").mockImplementation(() => undefined);
    jest.spyOn(globalThis, "emitNet").mockImplementation(() => undefined);
    jest.spyOn(globalThis, "RegisterCommand").mockImplementation(() => undefined);
    jest.spyOn(globalThis, "RegisterConsoleListener").mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  const registeredNativeHandler = (nativeMock: jest.Mock, name?: string): ((...args: unknown[]) => unknown) => {
    const call = name
      ? nativeMock.mock.calls.find(([registeredName]) => registeredName === name)
      : nativeMock.mock.calls[nativeMock.mock.calls.length - 1];

    return (name ? call[1] : call[0]) as (...args: unknown[]) => unknown;
  };

  it("should log an entry line for a command", async () => {
    class KickCommand {
      handle() {}
    }

    new CommandsRegistry().registerCommand(
      new KickCommand(),
      "handle",
      { name: "kick", canBeUsedByPlayers: true },
      KickCommand,
      handlerInvoker,
    );

    await registeredNativeHandler(RegisterCommand as jest.Mock, "kick")(42, [], "kick");

    expect(loggedMessages()).toEqual(expect.arrayContaining([expect.stringContaining('Executing @Command "kick"')]));
  });

  it("should log an entry line for an event", async () => {
    class PlayersController {
      handle() {}
    }

    new EventsRegistry().registerEventListener(
      new PlayersController(),
      "handle",
      { name: "playerJoined" },
      PlayersController,
      handlerInvoker,
    );

    registeredNativeHandler(on as jest.Mock, "playerJoined")();
    await flush();

    expect(loggedMessages()).toEqual(
      expect.arrayContaining([expect.stringContaining('Executing @OnEvent "playerJoined"')]),
    );
  });

  it("should log an entry line for a net event", async () => {
    class PlayersController {
      handle() {}
    }

    globalThis.source = 42;
    new EventsRegistry().registerNetEventListener(
      new PlayersController(),
      "handle",
      { name: "players:sync" },
      PlayersController,
      handlerInvoker,
    );

    registeredNativeHandler(onNet as jest.Mock, "players:sync")();
    await flush();

    expect(loggedMessages()).toEqual(
      expect.arrayContaining([expect.stringContaining('Executing @OnNetEvent "players:sync"')]),
    );
  });

  it("should not log an entry line for a console output listener", async () => {
    class ConsoleController {
      handle() {}
    }

    new EventsRegistry().registerConsoleOutputListener(
      new ConsoleController(),
      "handle",
      { channel: "script:test" },
      ConsoleController,
      handlerInvoker,
    );

    registeredNativeHandler(RegisterConsoleListener as jest.Mock)("script:test", "a console line");
    await flush();

    expect(loggedMessages()).toEqual([]);
  });

  it("should log an entry and a response line for a callback", async () => {
    class PlayersController {
      handle() {
        return { ok: true };
      }
    }

    new CallbacksRegistry().registerCallback(
      new PlayersController(),
      "handle",
      { name: "getPlayers" },
      PlayersController,
      handlerInvoker,
    );

    await registeredNativeHandler(on as jest.Mock, "__bytium_callbackCall:getPlayers")("response-1");

    expect(loggedMessages()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Executing @Callback "getPlayers"'),
        expect.stringMatching(/@Callback "getPlayers" -> done \(\d+ms\)/),
      ]),
    );
  });

  it("should log an error response line when a callback handler throws", async () => {
    class PlayersController {
      handle() {
        throw new Error("boom");
      }
    }

    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    new CallbacksRegistry().registerCallback(
      new PlayersController(),
      "handle",
      { name: "getPlayers" },
      PlayersController,
      handlerInvoker,
    );

    await registeredNativeHandler(on as jest.Mock, "__bytium_callbackCall:getPlayers")("response-1");

    expect(loggedMessages()).toEqual(
      expect.arrayContaining([expect.stringMatching(/@Callback "getPlayers" -> error \(\d+ms\)/)]),
    );

    errorSpy.mockRestore();
  });

  it("should log an entry line for a cron job", async () => {
    class CleanupProvider {
      handle() {}
    }

    const cronJobsRegistry = new CronJobsRegistry();

    cronJobsRegistry.registerCronJob(
      new CleanupProvider(),
      "handle",
      { expression: "*/5 * * * *" },
      CleanupProvider,
      handlerInvoker,
    );
    await cronJobsRegistry.getCronJobByProviderAndMethodName(CleanupProvider, "handle")?.handle();

    expect(loggedMessages()).toEqual(
      expect.arrayContaining([expect.stringContaining("Executing @Cron CleanupProvider.handle")]),
    );
  });

  it("should log an entry and a response line for a transferable method", async () => {
    class PermissionsFacade {
      addAce() {
        return true;
      }
    }

    const proxy = transferableMarshalerInstance.wrapForOwner(new PermissionsFacade());

    proxy.addAce();

    expect(loggedMessages()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Executing @Transferable PermissionsFacade.addAce invoked by "satellite-resource"'),
        expect.stringMatching(/@Transferable PermissionsFacade\.addAce -> done \(\d+ms\)/),
      ]),
    );
  });

  it("should log an error response line when a transferable method throws", async () => {
    class PermissionsFacade {
      addAce() {
        throw new Error("boom");
      }
    }

    const proxy = transferableMarshalerInstance.wrapForOwner(new PermissionsFacade());

    proxy.addAce();

    expect(loggedMessages()).toEqual(
      expect.arrayContaining([expect.stringMatching(/@Transferable PermissionsFacade\.addAce -> error \(\d+ms\)/)]),
    );
  });

  describe("with a boundary type excluded by the operator", () => {
    let shouldLogSpy: jest.SpyInstance;
    const excludeType = (excluded: string): void => {
      shouldLogSpy = jest
        .spyOn(boundaryLogManagerInstance, "shouldLog")
        .mockImplementation((type) => type !== excluded);
    };

    afterEach(() => {
      shouldLogSpy.mockRestore();
    });

    it("should not log an entry line for an excluded command", async () => {
      excludeType("COMMAND");

      class KickCommand {
        handle() {}
      }

      new CommandsRegistry().registerCommand(
        new KickCommand(),
        "handle",
        { name: "kick", canBeUsedByPlayers: true },
        KickCommand,
        handlerInvoker,
      );

      await registeredNativeHandler(RegisterCommand as jest.Mock, "kick")(42, [], "kick");

      expect(loggedMessages()).not.toEqual(
        expect.arrayContaining([expect.stringContaining('Executing @Command "kick"')]),
      );
    });

    it("should not log the entry and done lines for an excluded callback", async () => {
      excludeType("CALLBACK");

      class PlayersController {
        handle() {
          return { ok: true };
        }
      }

      new CallbacksRegistry().registerCallback(
        new PlayersController(),
        "handle",
        { name: "getPlayers" },
        PlayersController,
        handlerInvoker,
      );

      await registeredNativeHandler(on as jest.Mock, "__bytium_callbackCall:getPlayers")("response-1");

      expect(loggedMessages()).toEqual([]);
    });

    it("should still log the error line and response for an excluded callback that throws", async () => {
      excludeType("CALLBACK");

      class PlayersController {
        handle() {
          throw new Error("boom");
        }
      }

      const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

      new CallbacksRegistry().registerCallback(
        new PlayersController(),
        "handle",
        { name: "getPlayers" },
        PlayersController,
        handlerInvoker,
      );

      await registeredNativeHandler(on as jest.Mock, "__bytium_callbackCall:getPlayers")("response-1");

      expect(loggedMessages()).toEqual(
        expect.arrayContaining([expect.stringMatching(/@Callback "getPlayers" -> error \(\d+ms\)/)]),
      );

      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it("should still log the error response line for an excluded transferable that throws", async () => {
      excludeType("TRANSFERABLE");

      class PermissionsFacade {
        addAce() {
          throw new Error("boom");
        }
      }

      const proxy = transferableMarshalerInstance.wrapForOwner(new PermissionsFacade());

      proxy.addAce();

      expect(loggedMessages()).not.toEqual(
        expect.arrayContaining([expect.stringContaining("Executing @Transferable")]),
      );
      expect(loggedMessages()).toEqual(
        expect.arrayContaining([expect.stringMatching(/@Transferable PermissionsFacade\.addAce -> error \(\d+ms\)/)]),
      );
    });
  });
});
