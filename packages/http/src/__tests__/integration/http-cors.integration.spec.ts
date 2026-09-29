import "reflect-metadata";
import { Test } from "@bytium-core/testing";
import { cors, Get, HttpController, HttpModule } from "@http";
import { NativeHttpRequest } from "@http/interfaces/native-http-request.interface";
import { NativeHttpResponse } from "@http/interfaces/native-http-response.interface";

const mockRequest = (method: string, path: string, headers: Record<string, string> = {}): NativeHttpRequest => ({
  address: "127.0.0.1",
  path,
  method,
  headers,
  setDataHandler: (() => undefined) as NativeHttpRequest["setDataHandler"],
  setCancelHandler: () => undefined,
});
const mockResponse = (): NativeHttpResponse & { statusCode: number; headers: Record<string, string | string[]> } => {
  const response = {
    statusCode: 0,
    headers: {} as Record<string, string | string[]>,
    writeHead: (code: number, headers: Record<string, string | string[]> = {}) => {
      response.statusCode = code;
      response.headers = headers;
    },
    write: (): void => undefined,
    send: (): void => undefined,
  };

  return response;
};

describe("HTTP CORS", () => {
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

  it("should set the configured CORS headers on a normal request and still run the handler", async () => {
    let handlerRan = false;

    @HttpController("")
    class RootController {
      @Get("/ping")
      ping() {
        handlerRan = true;

        return { ok: true };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [
        HttpModule.forRoot({
          middleware: [cors({ origin: "https://my-app", credentials: true, maxAge: 600 })],
        }),
      ],
      controllers: [RootController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/ping", { origin: "https://my-app" }), response);
    await flush();

    expect(handlerRan).toBe(true);

    expect(response.statusCode).toBe(200);
    expect(response.headers["Access-Control-Allow-Origin"]).toBe("https://my-app");
    expect(response.headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(response.headers["Access-Control-Max-Age"]).toBe("600");

    await testingModule.close();
  });

  it("should answer an OPTIONS preflight with 204 and CORS headers without running the handler", async () => {
    let handlerRan = false;

    @HttpController("")
    class RootController {
      @Get("/ping")
      ping() {
        handlerRan = true;

        return { ok: true };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot({ middleware: [cors({ origin: "https://my-app" })] })],
      controllers: [RootController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("OPTIONS", "/ping", { origin: "https://my-app" }), response);
    await flush();

    expect(handlerRan).toBe(false);

    expect(response.statusCode).toBe(204);
    expect(response.headers["Access-Control-Allow-Origin"]).toBe("https://my-app");

    await testingModule.close();
  });

  it("should reflect an allowed origin and omit the header entirely for a disallowed one", async () => {
    @HttpController("")
    class RootController {
      @Get("/ping")
      ping() {
        return { ok: true };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot({ middleware: [cors({ origin: ["https://allowed.app"] })] })],
      controllers: [RootController],
    }).compile();
    const allowed = mockResponse();

    httpHandler(mockRequest("GET", "/ping", { origin: "https://allowed.app" }), allowed);
    await flush();

    expect(allowed.headers["Access-Control-Allow-Origin"]).toBe("https://allowed.app");

    const blocked = mockResponse();

    httpHandler(mockRequest("GET", "/ping", { origin: "https://evil.app" }), blocked);
    await flush();

    expect(blocked.headers["Access-Control-Allow-Origin"]).toBeUndefined();

    await testingModule.close();
  });

  it("should apply permissive defaults and echo the requested headers when no options are given", async () => {
    @HttpController("")
    class RootController {
      @Get("/ping")
      ping() {
        return { ok: true };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot({ middleware: [cors()] })],
      controllers: [RootController],
    }).compile();
    const response = mockResponse();

    httpHandler(
      mockRequest("OPTIONS", "/ping", { "access-control-request-headers": "x-custom, authorization" }),
      response,
    );
    await flush();

    expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(response.headers["Access-Control-Allow-Methods"]).toBe("GET,HEAD,PUT,PATCH,POST,DELETE");
    expect(response.headers["Access-Control-Allow-Headers"]).toBe("x-custom, authorization");

    await testingModule.close();
  });
});
