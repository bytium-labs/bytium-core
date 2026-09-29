import "reflect-metadata";
import {
  APP_GUARD,
  BytiumResource,
  BytiumResourceModule,
  CanActivate,
  Catch,
  Controller,
  ExceptionFilter,
  Injectable,
  Interceptor,
  ParseIntPipe,
  PipeTransform,
  StandardSchemaV1,
  UseFilter,
  UseGuard,
  UseInterceptor,
  UsePipe,
} from "@core";
import { Arg, Source, Args, RawCommand } from "@citizenfx";
import { Command } from "@citizenfx/decorators/client/command.decorator";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";

describe("Commands registry", () => {
  let dependencyGraph: DependencyGraph;
  let dependencyManager: BytiumDependencyManager;
  let registeredCommandHandlers: Record<string, (source: number, args: string[], rawCommand: string) => void>;
  let originalRegisterCommand: typeof RegisterCommand;
  const flushMicrotasks = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  beforeEach(() => {
    registeredCommandHandlers = {};
    originalRegisterCommand = global.RegisterCommand;
    global.RegisterCommand = ((name: string, handler: (source: number, args: string[], rawCommand: string) => void) => {
      registeredCommandHandlers[name] = handler;
    }) as unknown as typeof RegisterCommand;

    dependencyGraph = new DependencyGraph();
    dependencyManager = new BytiumDependencyManager(dependencyGraph);
  });

  afterEach(async () => {
    global.RegisterCommand = originalRegisterCommand;
    await dependencyManager.destroyAll();
  });

  it("should invoke a @Command handler with each argument resolved from its param decorators", async () => {
    const received: { args?: string[]; source?: number; rawCommand?: string } = {};

    @Controller()
    class CommandControllerA {
      @Command("test")
      handle(@Args() args: string[], @Source() source: number, @RawCommand() rawCommand: string) {
        received.args = args;
        received.source = source;
        received.rawCommand = rawCommand;
      }
    }

    @BytiumResourceModule({ name: "testModule", controllers: [CommandControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["test"](5, ["kick", "reason"], "test kick reason");
    await flushMicrotasks();

    expect(received.args).toEqual(["kick", "reason"]);
    expect(received.source).toBe(5);
    expect(received.rawCommand).toBe("test kick reason");
  });

  it("should resolve only the parameters the handler declares, in their declared order", async () => {
    const received: { rawCommand?: string; args?: string[] } = {};

    @Controller()
    class CommandControllerA {
      @Command("teleport")
      handle(@RawCommand() rawCommand: string, @Args() args: string[]) {
        received.rawCommand = rawCommand;
        received.args = args;
      }
    }

    @BytiumResourceModule({ name: "testModule", controllers: [CommandControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["teleport"](1, ["5"], "teleport 5");
    await flushMicrotasks();

    expect(received.rawCommand).toBe("teleport 5");
    expect(received.args).toEqual(["5"]);
  });

  it("should not run a guarded @Command handler when the guard denies", async () => {
    let handlerRan = false;

    @Injectable()
    class DenyGuard implements CanActivate {
      canActivate() {
        return false;
      }
    }

    @Controller()
    class CommandControllerA {
      @Command("test")
      @UseGuard(DenyGuard)
      handle() {
        handlerRan = true;
      }
    }

    @BytiumResourceModule({ name: "testModule", providers: [DenyGuard], controllers: [CommandControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["test"](5, [], "test");
    await flushMicrotasks();

    expect(handlerRan).toBe(false);
  });

  it("should run a guarded @Command handler when the guard allows", async () => {
    let handlerRan = false;

    @Injectable()
    class AllowGuard implements CanActivate {
      canActivate() {
        return true;
      }
    }

    @Controller()
    class CommandControllerA {
      @Command("test")
      @UseGuard(AllowGuard)
      handle() {
        handlerRan = true;
      }
    }

    @BytiumResourceModule({ name: "testModule", providers: [AllowGuard], controllers: [CommandControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["test"](5, [], "test");
    await flushMicrotasks();

    expect(handlerRan).toBe(true);
  });

  it("should apply a resource-wide APP_GUARD to a command handler that has no @UseGuard", async () => {
    let handlerRan = false;

    @Injectable()
    class DenyGuard implements CanActivate {
      canActivate() {
        return false;
      }
    }

    @Controller()
    class CommandControllerA {
      @Command("test")
      handle() {
        handlerRan = true;
      }
    }

    @BytiumResourceModule({
      name: "testModule",
      providers: [{ provide: APP_GUARD, useClass: DenyGuard, multi: true }],
      controllers: [CommandControllerA],
    })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["test"](5, [], "test");
    await flushMicrotasks();

    expect(handlerRan).toBe(false);
  });

  it("should transform a @Command handler's arguments through @UsePipe", async () => {
    let receivedSource = -1;

    class DoubleSourcePipe implements PipeTransform {
      transform(value: unknown) {
        return typeof value === "number" ? value * 2 : value;
      }
    }

    @Controller()
    class CommandControllerA {
      @Command("test")
      @UsePipe(DoubleSourcePipe)
      handle(@Source() source: number) {
        receivedSource = source;
      }
    }

    @BytiumResourceModule({ name: "testModule", controllers: [CommandControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["test"](5, [], "test");
    await flushMicrotasks();

    expect(receivedSource).toBe(10);
  });

  it("should coerce a @Command argument through a param-level pipe", async () => {
    let receivedId: unknown = "untouched";

    @Controller()
    class CommandControllerA {
      @Command("give")
      handle(@Arg(0, ParseIntPipe) playerId: number) {
        receivedId = playerId;
      }
    }

    @BytiumResourceModule({ name: "testModule", controllers: [CommandControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["give"](1, ["5"], "give 5");
    await flushMicrotasks();

    expect(receivedId).toBe(5);
  });

  it("should validate a @Command argument through a Standard Schema pipe", async () => {
    let received: unknown = "untouched";
    const nameSchema: StandardSchemaV1<unknown, string> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (value) =>
          typeof value === "string" && value.length >= 3
            ? { value }
            : { issues: [{ message: "must be at least 3 characters", path: [] }] },
      },
    };

    @Controller()
    class CommandControllerA {
      @Command("create")
      handle(@Arg(0, nameSchema) name: string) {
        received = name;
      }
    }

    @BytiumResourceModule({ name: "testModule", controllers: [CommandControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["create"](1, ["Ada"], "create Ada");
    await flushMicrotasks();

    expect(received).toBe("Ada");

    received = "untouched";

    registeredCommandHandlers["create"](1, ["ab"], "create ab");
    await flushMicrotasks();

    expect(received).toBe("untouched");
  });

  it("should wrap a @Command handler with @UseInterceptor", async () => {
    const calls: string[] = [];

    @Injectable()
    class TracingInterceptor implements Interceptor {
      async intercept(_context: unknown, next: () => Promise<unknown>) {
        calls.push("before");
        const result = await next();

        calls.push("after");

        return result;
      }
    }

    @Controller()
    class CommandControllerA {
      @Command("test")
      @UseInterceptor(TracingInterceptor)
      handle() {
        calls.push("handler");
      }
    }

    @BytiumResourceModule({ name: "testModule", controllers: [CommandControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["test"](5, [], "test");
    await flushMicrotasks();

    expect(calls).toEqual(["before", "handler", "after"]);
  });

  it("should handle a @Command handler error with a @UseFilter exception filter", async () => {
    let caught: unknown = null;

    class InsufficientFundsException extends Error {}

    @Catch(InsufficientFundsException)
    @Injectable()
    class FundsFilter implements ExceptionFilter {
      catch(exception: unknown) {
        caught = exception;
      }
    }

    @Controller()
    class CommandControllerA {
      @Command("buy")
      @UseFilter(FundsFilter)
      handle() {
        throw new InsufficientFundsException("broke");
      }
    }

    @BytiumResourceModule({ name: "testModule", controllers: [CommandControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["buy"](5, [], "buy");
    await flushMicrotasks();

    expect(caught).toBeInstanceOf(InsufficientFundsException);
  });

  it("should resolve a guard together with its own injected dependencies", async () => {
    let handlerRan = false;

    @Injectable()
    class PermissionService {
      isAllowed(): boolean {
        return false;
      }
    }

    @Injectable()
    class FactionGuard implements CanActivate {
      constructor(private readonly permissionService: PermissionService) {}

      canActivate(): boolean {
        return this.permissionService.isAllowed();
      }
    }

    @Controller()
    class CommandControllerA {
      @Command("faction")
      @UseGuard(FactionGuard)
      handle() {
        handlerRan = true;
      }
    }

    @BytiumResourceModule({
      name: "testModule",
      providers: [PermissionService, FactionGuard],
      controllers: [CommandControllerA],
    })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["faction"](5, [], "faction");
    await flushMicrotasks();

    expect(handlerRan).toBe(false);
  });

  it("should apply a class-level @UseGuard to every handler of the controller", async () => {
    let handlerRan = false;

    @Injectable()
    class DenyGuard implements CanActivate {
      canActivate() {
        return false;
      }
    }

    @Controller()
    @UseGuard(DenyGuard)
    class CommandControllerA {
      @Command("test")
      handle() {
        handlerRan = true;
      }
    }

    @BytiumResourceModule({ name: "testModule", providers: [DenyGuard], controllers: [CommandControllerA] })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["test"](5, [], "test");
    await flushMicrotasks();

    expect(handlerRan).toBe(false);
  });

  it("should evaluate both class-level and method-level guards", async () => {
    let handlerRan = false;

    @Injectable()
    class AllowGuard implements CanActivate {
      canActivate() {
        return true;
      }
    }

    @Injectable()
    class DenyGuard implements CanActivate {
      canActivate() {
        return false;
      }
    }

    @Controller()
    @UseGuard(AllowGuard)
    class CommandControllerA {
      @Command("test")
      @UseGuard(DenyGuard)
      handle() {
        handlerRan = true;
      }
    }

    @BytiumResourceModule({
      name: "testModule",
      providers: [AllowGuard, DenyGuard],
      controllers: [CommandControllerA],
    })
    class TestModule {}

    @BytiumResource({ modules: [TestModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    registeredCommandHandlers["test"](5, [], "test");
    await flushMicrotasks();

    expect(handlerRan).toBe(false);
  });
});
