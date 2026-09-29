import "reflect-metadata";
import { Injectable } from "@bytium-core/common";
import { Test } from "@bytium-core/testing";
import { Body, Get, HttpController, HttpModule, OnRequestEnd, Post, REQUEST, Res, Version } from "@http";
import { HttpResponse } from "@http/models/http-response.model";
import { NativeHttpRequest } from "@http/interfaces/native-http-request.interface";
import { NativeHttpResponse } from "@http/interfaces/native-http-response.interface";

interface MockResponse extends NativeHttpResponse {
  statusCode: number;
  writes: string[];
  sentBody: string;
  finished: boolean;
}

const mockRequest = (
  method: string,
  path: string,
  options: { headers?: Record<string, string>; binary?: ArrayBuffer } = {},
): NativeHttpRequest => ({
  address: "127.0.0.1",
  path,
  method,
  headers: {
    ...(options.binary !== undefined ? { "content-length": String(options.binary.byteLength) } : {}),
    ...(options.headers ?? {}),
  },
  setDataHandler: ((handler: (data: string | ArrayBuffer) => void, binary?: "binary") => {
    if (binary === "binary" && options.binary !== undefined) handler(options.binary);
  }) as NativeHttpRequest["setDataHandler"],
  setCancelHandler: () => undefined,
});
const mockResponse = (): MockResponse => {
  const response: MockResponse = {
    statusCode: 0,
    writes: [],
    sentBody: "",
    finished: false,
    writeHead: (code) => {
      response.statusCode = code;
    },
    write: (data) => {
      response.writes.push(data);
    },
    send: (data = "") => {
      response.sentBody = data;
      response.finished = true;
    },
  };

  return response;
};

describe("HTTP advanced features", () => {
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

  it("should stream a response through res.write and finish with send", async () => {
    @HttpController("/stream")
    class StreamController {
      @Get()
      stream(@Res() res: HttpResponse) {
        res.write("chunk-1").write("chunk-2").send("done");
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [StreamController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/stream"), response);
    await flush();

    expect(response.writes).toEqual(["chunk-1", "chunk-2"]);
    expect(response.sentBody).toBe("done");

    await testingModule.close();
  });

  it("should read a binary body for a binary route", async () => {
    let received: unknown = null;
    const payload = new Uint8Array([1, 2, 3]).buffer;

    @HttpController("/upload")
    class UploadController {
      @Post("", { binary: true })
      upload(@Body() body: ArrayBuffer) {
        received = body;

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [UploadController],
    }).compile();

    httpHandler(mockRequest("POST", "/upload", { binary: payload }), mockResponse());
    await flush();

    expect(received).toBe(payload);

    await testingModule.close();
  });

  it("should accept an image upload as a binary body and expose its bytes", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]).buffer;

    @HttpController("/avatars")
    class AvatarController {
      @Post("", { binary: true })
      upload(@Body() image: ArrayBuffer) {
        const header = new Uint8Array(image.slice(0, 4));
        const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;

        return { format: isPng ? "png" : "unknown", size: image.byteLength };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [AvatarController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest("POST", "/avatars", { binary: png }), response);
    await flush();

    expect(JSON.parse(response.sentBody)).toEqual({ format: "png", size: 10 });

    await testingModule.close();
  });

  it("should read a multipart/form-data body as binary even on a non-binary route", async () => {
    let received: unknown = null;
    const payload = new Uint8Array([10, 20, 30]).buffer;

    @HttpController("/upload")
    class UploadController {
      @Post()
      upload(@Body() body: unknown) {
        received = body;

        return {};
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [UploadController],
    }).compile();

    httpHandler(
      mockRequest("POST", "/upload", {
        headers: { "content-type": "multipart/form-data; boundary=xyz" },
        binary: payload,
      }),
      mockResponse(),
    );
    await flush();

    expect(received).toBe(payload);

    await testingModule.close();
  });

  it("should match a route by version from the X-API-Version header", async () => {
    @HttpController("/data")
    class DataController {
      @Get()
      @Version("2")
      getData() {
        return { version: 2 };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [DataController],
    }).compile();
    const matching = mockResponse();
    const mismatching = mockResponse();

    httpHandler(mockRequest("GET", "/data", { headers: { "X-API-Version": "2" } }), matching);
    await flush();
    httpHandler(mockRequest("GET", "/data", { headers: { "X-API-Version": "1" } }), mismatching);
    await flush();

    expect(matching.statusCode).toBe(200);
    expect(mismatching.statusCode).toBe(404);

    await testingModule.close();
  });

  it("should call onRequestEnd on a request-scoped provider after the response", async () => {
    let ended = false;

    @Injectable({ scope: REQUEST })
    class UnitOfWork implements OnRequestEnd {
      onRequestEnd() {
        ended = true;
      }
    }

    @HttpController("/work")
    class WorkController {
      constructor(private readonly unitOfWork: UnitOfWork) {}

      @Get()
      run() {
        return { ok: Boolean(this.unitOfWork) };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      providers: [UnitOfWork],
      controllers: [WorkController],
    }).compile();

    httpHandler(mockRequest("GET", "/work"), mockResponse());
    await flush();

    expect(ended).toBe(true);

    await testingModule.close();
  });
});
