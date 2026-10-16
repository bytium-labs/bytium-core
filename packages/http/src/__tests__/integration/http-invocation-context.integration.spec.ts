import "reflect-metadata";
import { Injectable, InvocationContext, InvocationContextInterface, sensitive } from "@bytium-core/common";
import { Test } from "@bytium-core/testing";
import { Body, Get, HttpController, HttpModule, NotFoundException, OnRequestEnd, Post, REQUEST } from "@http";
import { HttpRequestLogLevelEnum } from "@http/enums/http-request-log-level.enum";
import { httpRequestLogManagerInstance } from "@http/managers/http-request-log.manager";
import { NativeHttpRequest } from "@http/interfaces/native-http-request.interface";
import { NativeHttpResponse } from "@http/interfaces/native-http-response.interface";

interface MockResponse extends NativeHttpResponse {
  statusCode: number;
  sentBody: string;
}

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
const mockResponse = (): MockResponse => {
  const response: MockResponse = {
    statusCode: 0,
    sentBody: "",
    writeHead: (code) => {
      response.statusCode = code;
    },
    write: () => undefined,
    send: (data = "") => {
      response.sentBody = data;
    },
  };

  return response;
};

describe("HTTP invocation context", () => {
  let httpHandler: (request: NativeHttpRequest, response: NativeHttpResponse) => void;
  let logSpy: jest.SpyInstance;
  const flush = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
  };
  const loggedLines = (): string[] => logSpy.mock.calls.map((call) => String(call[0]));
  const scopedBucket = (scopedSpy: jest.SpyInstance, bucket: "request" | "response"): Record<string, unknown> =>
    (scopedSpy.mock.calls.map((call) => (call[0] as Record<string, Record<string, unknown>>)[bucket]).find(Boolean) ??
      {}) as Record<string, unknown>;

  beforeEach(() => {
    // per-test global spy is safe here: http's jest-setup natives are jest.fn, so restoreAllMocks keeps the property
    jest.spyOn(globalThis, "IsDuplicityVersion").mockReturnValue(true);
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(globalThis, "SetHttpHandler").mockImplementation((handler) => {
      httpHandler = handler as (request: NativeHttpRequest, response: NativeHttpResponse) => void;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should expose a lean invocation context to the handler", async () => {
    let handlerContext: InvocationContextInterface | undefined;

    @HttpController("/players")
    class PlayersController {
      @Get("/list")
      list() {
        handlerContext = InvocationContext.current();

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();

    httpHandler(mockRequest("GET", "/players/list"), mockResponse());
    await flush();

    expect(handlerContext?.type).toBe("HTTP");
    expect(handlerContext?.handler).toBe("PlayersController.list");
    expect(handlerContext?.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(handlerContext).not.toHaveProperty("__bytiumMetadata");

    await testingModule.close();
  });

  it("should run request-end hooks within the same invocation", async () => {
    let handlerContext: InvocationContextInterface | undefined;
    let requestEndContext: InvocationContextInterface | undefined;

    @Injectable({ scope: REQUEST })
    class UnitOfWork implements OnRequestEnd {
      onRequestEnd() {
        requestEndContext = InvocationContext.current();
      }
    }

    @HttpController("/work")
    class WorkController {
      constructor(private readonly unitOfWork: UnitOfWork) {}

      @Get()
      run() {
        handlerContext = InvocationContext.current();

        return { ok: Boolean(this.unitOfWork) };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [WorkController],
      providers: [UnitOfWork],
    }).compile();

    httpHandler(mockRequest("GET", "/work"), mockResponse());
    await flush();

    expect(requestEndContext?.correlationId).toBe(handlerContext?.correlationId);
    expect(requestEndContext).not.toHaveProperty("__bytiumMetadata");

    await testingModule.close();
  });

  it("should keep the access buckets lean at the default LEAN level", async () => {
    const scopedSpy = jest.spyOn(InvocationContext, "scoped");

    @HttpController("/players")
    class PlayersController {
      @Get("/list")
      list() {
        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();

    httpHandler(mockRequest("GET", "/players/list"), mockResponse());
    await flush();

    expect(scopedBucket(scopedSpy, "request")).toEqual({ method: "GET", path: "/players/list" });

    expect(scopedBucket(scopedSpy, "response")).not.toHaveProperty("headers");

    await testingModule.close();
  });

  it("should log the transport fields and the masked body at the FULL level", async () => {
    jest.spyOn(httpRequestLogManagerInstance, "getLevel").mockReturnValue(HttpRequestLogLevelEnum.FULL);
    jest.spyOn(httpRequestLogManagerInstance, "getMaskedHeaders").mockReturnValue(["x-trace"]);
    jest.spyOn(httpRequestLogManagerInstance, "getMaskedKeys").mockReturnValue([]);
    const scopedSpy = jest.spyOn(InvocationContext, "scoped");
    const bodySchema = sensitive(
      { "~standard": { version: 1, vendor: "test", validate: (value: unknown) => ({ value }) } },
      ["password"],
    );

    @HttpController("/accounts")
    class AccountsController {
      @Post()
      create(@Body(bodySchema) dto: object) {
        return dto;
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [AccountsController],
    }).compile();

    httpHandler(
      mockRequest("POST", "/accounts?page=2", JSON.stringify({ login: "lilabyte", password: "hunter2" })),
      mockResponse(),
    );
    await flush();

    const requestBucket = scopedBucket(scopedSpy, "request");

    expect(requestBucket.url).toBe("/accounts?page=2");
    expect(requestBucket.query).toEqual({ page: "2" });
    expect(requestBucket.body).toEqual({ login: "lilabyte", password: "[REDACTED]" });

    expect(scopedBucket(scopedSpy, "response")).toHaveProperty("headers");

    await testingModule.close();
  });

  it("should log an access line with the method, path, status and duration after the response is sent", async () => {
    @HttpController("/players")
    class PlayersController {
      @Get("/list")
      list() {
        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();

    httpHandler(mockRequest("GET", "/players/list"), mockResponse());
    await flush();

    expect(loggedLines()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/HTTP GET \/players\/list$/),
        expect.stringMatching(/HTTP GET \/players\/list -> 200 \(\d+ms\)/),
      ]),
    );

    await testingModule.close();
  });

  it("should log the error status in the access line when the handler throws", async () => {
    @HttpController("/players")
    class PlayersController {
      @Get("/list")
      list() {
        throw new NotFoundException("no players here");
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/players/list"), response);
    await flush();

    expect(loggedLines()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/HTTP GET \/players\/list -> 404 \(\d+ms\)/),
        expect.stringContaining("Error while handling HTTP request:"),
      ]),
    );

    expect(response.statusCode).toBe(404);

    await testingModule.close();
  });
});
