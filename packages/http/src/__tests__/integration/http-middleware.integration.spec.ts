import "reflect-metadata";
import { Injectable } from "@bytium-core/common";
import { Test } from "@bytium-core/testing";
import { Get, HttpController, HttpMiddleware, HttpModule, UnauthorizedException } from "@http";
import { HttpRequest } from "@http/models/http-request.model";
import { HttpResponse } from "@http/models/http-response.model";
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

describe("HTTP middleware", () => {
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

  it("should run a middleware before routing and short-circuit when it responds", async () => {
    const seenPaths: string[] = [];
    let handlerRan = false;

    @Injectable()
    class GateMiddleware implements HttpMiddleware {
      async use(request: HttpRequest, response: HttpResponse, next: () => Promise<void>) {
        seenPaths.push(request.path);

        if (request.path === "/blocked") {
          response.status(401).send();

          return;
        }

        await next();
      }
    }

    @HttpController("")
    class RootController {
      @Get("/blocked")
      blocked() {
        handlerRan = true;

        return {};
      }

      @Get("/open")
      open() {
        handlerRan = true;

        return { ok: true };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot({ middleware: [GateMiddleware] })],
      controllers: [RootController],
    }).compile();
    const blockedResponse = mockResponse();

    httpHandler(mockRequest("GET", "/blocked"), blockedResponse);
    await flush();

    expect(blockedResponse.statusCode).toBe(401);
    expect(handlerRan).toBe(false);

    const openResponse = mockResponse();

    httpHandler(mockRequest("GET", "/open"), openResponse);
    await flush();

    expect(openResponse.statusCode).toBe(200);
    expect(handlerRan).toBe(true);
    expect(seenPaths).toEqual(["/blocked", "/open"]);

    await testingModule.close();
  });

  it("should map an HttpException thrown by a middleware to its status instead of a 500", async () => {
    let handlerRan = false;

    @Injectable()
    class RejectingMiddleware implements HttpMiddleware {
      async use() {
        throw new UnauthorizedException();
      }
    }

    @HttpController("")
    class RootController {
      @Get("/secret")
      secret() {
        handlerRan = true;

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot({ middleware: [RejectingMiddleware] })],
      controllers: [RootController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/secret"), response);
    await flush();

    expect(response.statusCode).toBe(401);
    expect(handlerRan).toBe(false);

    await testingModule.close();
  });
});
