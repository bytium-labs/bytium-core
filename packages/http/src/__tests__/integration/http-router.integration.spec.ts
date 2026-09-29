import "reflect-metadata";
import { ParseIntPipe, StandardSchemaV1, ValidationException } from "@bytium-core/common";
import { Test } from "@bytium-core/testing";
import { All, Body, Get, Head, HttpController, HttpModule, HttpRequest, NotFoundException, Param, Post } from "@http";
import { NativeHttpRequest } from "@http/interfaces/native-http-request.interface";
import { NativeHttpResponse } from "@http/interfaces/native-http-response.interface";

interface MockResponse extends NativeHttpResponse {
  statusCode: number;
  sentBody: string;
}

const mockRequest = (
  method: string,
  path: string,
  body?: string,
  contentType = "application/json",
): NativeHttpRequest => ({
  address: "127.0.0.1",
  path,
  method,
  headers: {
    "content-type": contentType,
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

describe("HTTP router", () => {
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

  it("should match a @Head route and match a wildcard @All route on any method", async () => {
    @HttpController("")
    class RootController {
      @Head("/ping")
      ping() {
        return {};
      }

      @All("/any")
      any() {
        return { matched: true };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [RootController],
    }).compile();
    const headResponse = mockResponse();

    httpHandler(mockRequest("HEAD", "/ping"), headResponse);
    await flush();

    expect(headResponse.statusCode).toBe(200);

    for (const method of ["GET", "POST", "DELETE"]) {
      const response = mockResponse();

      httpHandler(mockRequest(method, "/any"), response);
      await flush();

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.sentBody)).toEqual({ matched: true });
    }

    await testingModule.close();
  });

  it("should map a parse pipe failure to 400 Bad Request", async () => {
    @HttpController("/players")
    class PlayersController {
      @Get("/:id")
      getPlayer(@Param("id", ParseIntPipe) id: number) {
        return { id };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/players/abc"), response);
    await flush();

    expect(response.statusCode).toBe(400);

    await testingModule.close();
  });

  it("should route a request to its controller and send the returned value as JSON", async () => {
    @HttpController("/players")
    class PlayersController {
      constructor(private readonly request: HttpRequest) {}

      @Get("/:id")
      getPlayer() {
        return { id: this.request.params.id, path: this.request.path };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/players/5"), response);
    await flush();

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.sentBody)).toEqual({ id: "5", path: "/players/5" });

    await testingModule.close();
  });

  it("should prefer a static route over a parametric one regardless of declaration order", async () => {
    @HttpController("/players")
    class PlayersController {
      @Get("/:id")
      getPlayer() {
        return { matched: "param" };
      }

      @Get("/me")
      getMe() {
        return { matched: "static" };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/players/me"), response);
    await flush();

    expect(JSON.parse(response.sentBody)).toEqual({ matched: "static" });

    await testingModule.close();
  });

  it("should match a trailing named wildcard capturing the rest of the path", async () => {
    @HttpController("/files")
    class FilesController {
      constructor(private readonly request: HttpRequest) {}

      @Get("/*path")
      read() {
        return { path: this.request.params.path };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [FilesController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/files/images/avatar.png"), response);
    await flush();

    expect(JSON.parse(response.sentBody)).toEqual({ path: "images/avatar.png" });

    await testingModule.close();
  });

  it("should collect repeated query parameters into an array and keep single ones as strings", async () => {
    @HttpController("/search")
    class SearchController {
      constructor(private readonly request: HttpRequest) {}

      @Get()
      search() {
        return { tag: this.request.query.tag, sort: this.request.query.sort };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [SearchController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/search?tag=a&tag=b&sort=asc"), response);
    await flush();

    expect(JSON.parse(response.sentBody)).toEqual({ tag: ["a", "b"], sort: "asc" });

    await testingModule.close();
  });

  it("should map a thrown HttpException to its status and message", async () => {
    @HttpController("/players")
    class PlayersController {
      @Get("/:id")
      getPlayer() {
        throw new NotFoundException("Player not found");
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/players/5"), response);
    await flush();

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.sentBody)).toEqual({ statusCode: 404, message: "Player not found" });

    await testingModule.close();
  });

  it("should map a thrown ValidationException to a 400 with its per-field errors", async () => {
    @HttpController("/players")
    class PlayersController {
      @Get("/:id")
      getPlayer() {
        throw new ValidationException({ id: ["must be a number"] });
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/players/abc"), response);
    await flush();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.sentBody)).toEqual({
      statusCode: 400,
      message: "Validation failed",
      errors: { id: ["must be a number"] },
    });

    await testingModule.close();
  });

  it("should run a ValidationPipe on @Body and return 400 with per-field errors on failure", async () => {
    const schema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (value) =>
          typeof (value as { name?: unknown })?.name === "string"
            ? { value }
            : { issues: [{ message: "name is required", path: ["name"] }] },
      },
    };

    @HttpController("players")
    class PlayersController {
      @Post()
      create(@Body(schema) dto: unknown) {
        return { created: dto };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("POST", "/players", JSON.stringify({})), response);
    await flush();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.sentBody)).toEqual({
      statusCode: 400,
      message: "Validation failed",
      errors: { name: ["name is required"] },
    });

    await testingModule.close();
  });

  it("should not hang on a body-less POST and treat the missing body as empty", async () => {
    const schema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (value) =>
          typeof (value as { name?: unknown } | undefined)?.name === "string"
            ? { value }
            : { issues: [{ message: "name is required", path: ["name"] }] },
      },
    };

    @HttpController("players")
    class PlayersController {
      @Post()
      create(@Body(schema) dto: unknown) {
        return { created: dto };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("POST", "/players", undefined, ""), response);
    await flush();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.sentBody)).toEqual({
      statusCode: 400,
      message: "Validation failed",
      errors: { name: ["name is required"] },
    });

    await testingModule.close();
  });

  it("should reject a malformed application/json body with 400 Bad Request", async () => {
    @HttpController("players")
    class PlayersController {
      @Post()
      create(@Body() dto: unknown) {
        return { dto };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("POST", "/players", "not json at all"), response);
    await flush();

    const body = JSON.parse(response.sentBody);

    expect(response.statusCode).toBe(400);
    expect(body.statusCode).toBe(400);
    expect(body.message).toContain("JSON");

    await testingModule.close();
  });

  it("should parse an application/x-www-form-urlencoded body into an object", async () => {
    @HttpController("players")
    class PlayersController {
      @Post()
      create(@Body() dto: unknown) {
        return { dto };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("POST", "/players", "name=Alice&age=30", "application/x-www-form-urlencoded"), response);
    await flush();

    expect(JSON.parse(response.sentBody)).toEqual({ dto: { name: "Alice", age: "30" } });

    await testingModule.close();
  });

  it("should pass a text/plain body through as a raw string", async () => {
    @HttpController("echo")
    class EchoController {
      @Post()
      echo(@Body() body: unknown) {
        return { body };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [EchoController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("POST", "/echo", "hello world", "text/plain"), response);
    await flush();

    expect(JSON.parse(response.sentBody)).toEqual({ body: "hello world" });

    await testingModule.close();
  });

  it("should respond 404 when no route matches", async () => {
    @HttpController("/players")
    class PlayersController {
      @Get("/:id")
      getPlayer() {
        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/unknown/path"), response);
    await flush();

    expect(response.statusCode).toBe(404);

    await testingModule.close();
  });

  it("should instantiate a fresh contextual controller per request", async () => {
    let constructions = 0;

    @HttpController("/ping")
    class PingController {
      constructor() {
        constructions++;
      }

      @Get()
      ping() {
        return "pong";
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PingController],
    }).compile();

    httpHandler(mockRequest("GET", "/ping"), mockResponse());
    await flush();
    httpHandler(mockRequest("GET", "/ping"), mockResponse());
    await flush();

    expect(constructions).toBe(2);

    await testingModule.close();
  });
});
