import "reflect-metadata";
import { Test } from "@bytium-core/testing";
import { Body, Cookies, Get, Headers, HttpController, HttpModule, Ip, Param, Post, Query } from "@http";
import { NativeHttpRequest } from "@http/interfaces/native-http-request.interface";
import { NativeHttpResponse } from "@http/interfaces/native-http-response.interface";

const mockRequest = (method: string, path: string, body?: string): NativeHttpRequest => ({
  address: "127.0.0.1",
  path,
  method,
  headers: {
    "content-type": "application/json",
    ...(body === undefined ? {} : { "content-length": String(body.length) }),
  },
  setDataHandler: ((handler: (data: string) => void) => {
    if (body !== undefined) handler(body);
  }) as NativeHttpRequest["setDataHandler"],
  setCancelHandler: () => undefined,
});
const mockResponse = (): NativeHttpResponse & { sentBody: string } => {
  const response = {
    sentBody: "",
    writeHead: (): void => undefined,
    write: (): void => undefined,
    send: (data = "") => {
      response.sentBody = data;
    },
  };

  return response;
};

describe("HTTP param decorators", () => {
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

  it("should resolve @Param and @Query values", async () => {
    let received: { id: unknown; sort: unknown } = { id: null, sort: null };

    @HttpController("/players")
    class PlayersController {
      @Get("/:id")
      getPlayer(@Param("id") id: string, @Query("sort") sort: string) {
        received = { id, sort };

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();

    httpHandler(mockRequest("GET", "/players/42?sort=asc"), mockResponse());
    await flush();

    expect(received.id).toBe("42");
    expect(received.sort).toBe("asc");

    await testingModule.close();
  });

  it("should resolve @Headers case-insensitively regardless of the casing the client sent", async () => {
    let received: unknown = null;

    @HttpController("")
    class RootController {
      @Get("/whoami")
      whoami(@Headers("x-trace-id") traceId: string) {
        received = traceId;

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [RootController],
    }).compile();
    const native: NativeHttpRequest = {
      address: "127.0.0.1",
      path: "/whoami",
      method: "GET",
      headers: { "X-Trace-Id": "abc-123" },
      setDataHandler: (() => undefined) as NativeHttpRequest["setDataHandler"],
      setCancelHandler: () => undefined,
    };

    httpHandler(native, mockResponse());
    await flush();

    expect(received).toBe("abc-123");

    await testingModule.close();
  });

  it("should resolve @Cookies as a map of all cookies and as a single named value", async () => {
    let all: unknown = null;
    let one: unknown = null;

    @HttpController("")
    class RootController {
      @Get("/me")
      me(@Cookies() cookies: Record<string, string>, @Cookies("session") session: string) {
        all = cookies;
        one = session;

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [RootController],
    }).compile();
    const native: NativeHttpRequest = {
      address: "127.0.0.1",
      path: "/me",
      method: "GET",
      headers: { cookie: "session=abc123; theme=dark" },
      setDataHandler: (() => undefined) as NativeHttpRequest["setDataHandler"],
      setCancelHandler: () => undefined,
    };

    httpHandler(native, mockResponse());
    await flush();

    expect(all).toEqual({ session: "abc123", theme: "dark" });
    expect(one).toBe("abc123");

    await testingModule.close();
  });

  it("should resolve @Ip without the source port", async () => {
    let received: unknown = null;

    @HttpController("")
    class RootController {
      @Get("/ip")
      ip(@Ip() ip: string) {
        received = ip;

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [RootController],
    }).compile();
    const native: NativeHttpRequest = {
      address: "135.125.235.237:37244",
      path: "/ip",
      method: "GET",
      headers: {},
      setDataHandler: (() => undefined) as NativeHttpRequest["setDataHandler"],
      setCancelHandler: () => undefined,
    };

    httpHandler(native, mockResponse());
    await flush();

    expect(received).toBe("135.125.235.237");

    await testingModule.close();
  });

  it("should resolve @Body as parsed JSON", async () => {
    let received: unknown = null;

    @HttpController("/players")
    class PlayersController {
      @Post()
      create(@Body() body: { name: string }) {
        received = body;

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();

    httpHandler(mockRequest("POST", "/players", '{"name":"Ada"}'), mockResponse());
    await flush();

    expect(received).toEqual({ name: "Ada" });

    await testingModule.close();
  });
});
