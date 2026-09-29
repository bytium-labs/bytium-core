import "reflect-metadata";
import { Test } from "@bytium-core/testing";
import { Get, Header, HttpCode, HttpController, HttpModule, HttpResponse, Redirect, Res } from "@http";
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
const mockResponse = (): NativeHttpResponse & {
  statusCode: number;
  headers: Record<string, string | string[]>;
  sentBody: string;
} => {
  const response = {
    statusCode: 0,
    headers: {} as Record<string, string | string[]>,
    sentBody: "",
    writeHead: (code: number, headers: Record<string, string | string[]> = {}) => {
      response.statusCode = code;
      response.headers = headers;
    },
    write: (): void => undefined,
    send: (data = "") => {
      response.sentBody = data;
    },
  };

  return response;
};

describe("HTTP response decorators", () => {
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

  it("should apply @HttpCode and @Header to the response", async () => {
    @HttpController("/players")
    class PlayersController {
      @Get()
      @HttpCode(201)
      @Header("X-Custom", "bytium")
      create() {
        return { created: true };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/players"), response);
    await flush();

    expect(response.statusCode).toBe(201);
    expect(response.headers["X-Custom"]).toBe("bytium");
    expect(JSON.parse(response.sentBody)).toEqual({ created: true });

    await testingModule.close();
  });

  it("should not emit a duplicate header when the same name is set with different casing", async () => {
    @HttpController("/players")
    class PlayersController {
      @Get()
      list(@Res() response: HttpResponse) {
        response.header("content-type", "text/plain").json({ ok: true });
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [PlayersController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/players"), response);
    await flush();

    const contentTypeKeys = Object.keys(response.headers).filter((key) => key.toLowerCase() === "content-type");

    expect(contentTypeKeys).toHaveLength(1);
    expect(response.headers[contentTypeKeys[0]]).toBe("text/plain");

    await testingModule.close();
  });

  it("should set cookies as separate Set-Cookie headers with their attributes", async () => {
    @HttpController("")
    class RootController {
      @Get("/login")
      login(@Res() response: HttpResponse) {
        response
          .cookie("session", "abc123", { httpOnly: true, path: "/", maxAge: 3600, sameSite: "Lax" })
          .cookie("theme", "dark")
          .send();
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [RootController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/login"), response);
    await flush();

    expect(response.headers["Set-Cookie"]).toEqual([
      "session=abc123; Max-Age=3600; Path=/; HttpOnly; SameSite=Lax",
      "theme=dark",
    ]);

    await testingModule.close();
  });

  it("should redirect with @Redirect", async () => {
    @HttpController("/old")
    class OldController {
      @Get()
      @Redirect("/new", 301)
      moved() {
        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [OldController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/old"), response);
    await flush();

    expect(response.statusCode).toBe(301);
    expect(response.headers["Location"]).toBe("/new");

    await testingModule.close();
  });
});
