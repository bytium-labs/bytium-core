import "reflect-metadata";
import { CanActivate, Injectable, Interceptor, ParseIntPipe, UseGuard, UseInterceptor } from "@bytium-core/common";
import { Test } from "@bytium-core/testing";
import { Get, HttpController, HttpModule, Param } from "@http";
import { NativeHttpRequest } from "@http/interfaces/native-http-request.interface";
import { NativeHttpResponse } from "@http/interfaces/native-http-response.interface";

const mockRequest = (method: string, path: string): NativeHttpRequest => ({
  address: "127.0.0.1",
  path,
  method,
  headers: {},
  setDataHandler: (() => undefined) as NativeHttpRequest["setDataHandler"],
  setCancelHandler: () => undefined,
});
const mockResponse = (): NativeHttpResponse & { statusCode: number; sentBody: string } => {
  const response = {
    statusCode: 0,
    sentBody: "",
    writeHead: (code: number) => {
      response.statusCode = code;
    },
    write: (): void => undefined,
    send: (data = "") => {
      response.sentBody = data;
    },
  };

  return response;
};

describe("HTTP interception", () => {
  let httpHandler: (request: NativeHttpRequest, response: NativeHttpResponse) => void;
  let originalSetHttpHandler: typeof SetHttpHandler;
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  beforeEach(() => {
    originalSetHttpHandler = global.SetHttpHandler;
    global.SetHttpHandler = ((handler: (request: NativeHttpRequest, response: NativeHttpResponse) => void) => {
      httpHandler = handler;
    }) as typeof SetHttpHandler;
  });

  afterEach(() => {
    global.SetHttpHandler = originalSetHttpHandler;
  });

  it("should coerce a path param through a param-level pipe", async () => {
    let receivedId: unknown = null;

    @HttpController("/players")
    class PlayersController {
      @Get("/:id")
      getPlayer(@Param("id", ParseIntPipe) id: number) {
        receivedId = id;

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();

    httpHandler(mockRequest("GET", "/players/42"), mockResponse());
    await flush();

    expect(receivedId).toBe(42);

    await testingModule.close();
  });

  it("should respond 403 and skip the handler when a guard denies", async () => {
    let handlerRan = false;

    @Injectable()
    class DenyGuard implements CanActivate {
      canActivate() {
        return false;
      }
    }

    @HttpController("/admin")
    class AdminController {
      @Get()
      @UseGuard(DenyGuard)
      handle() {
        handlerRan = true;

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      providers: [DenyGuard],
      controllers: [AdminController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/admin"), response);
    await flush();

    expect(handlerRan).toBe(false);
    expect(response.statusCode).toBe(403);

    await testingModule.close();
  });

  it("should apply a class-level @UseGuard to every route of the controller", async () => {
    let handlerRan = false;

    @Injectable()
    class DenyGuard implements CanActivate {
      canActivate() {
        return false;
      }
    }

    @HttpController("/admin")
    @UseGuard(DenyGuard)
    class AdminController {
      @Get("/users")
      users() {
        handlerRan = true;

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      providers: [DenyGuard],
      controllers: [AdminController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/admin/users"), response);
    await flush();

    expect(handlerRan).toBe(false);
    expect(response.statusCode).toBe(403);

    await testingModule.close();
  });

  it("should replace a guard via overrideGuard even when it is not a registered provider", async () => {
    let handlerRan = false;

    @Injectable()
    class RealGuard implements CanActivate {
      canActivate() {
        return false;
      }
    }

    @HttpController("/admin")
    class AdminController {
      @Get()
      @UseGuard(RealGuard)
      handle() {
        handlerRan = true;

        return { ok: true };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [AdminController],
    })
      .overrideGuard(RealGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/admin"), response);
    await flush();

    expect(handlerRan).toBe(true);
    expect(response.statusCode).toBe(200);

    await testingModule.close();
  });

  it("should run an interceptor around the handler", async () => {
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

    @HttpController("/ping")
    class PingController {
      @Get()
      @UseInterceptor(TracingInterceptor)
      ping() {
        calls.push("handler");

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      providers: [TracingInterceptor],
      controllers: [PingController],
    }).compile();

    httpHandler(mockRequest("GET", "/ping"), mockResponse());
    await flush();

    expect(calls).toEqual(["before", "handler", "after"]);

    await testingModule.close();
  });
});
