import "reflect-metadata";
import { UseInterceptor } from "@bytium-core/common";
import { HttpController, HttpModule, Post } from "@bytium-core/http";
import { Test } from "@bytium-core/testing";
import { Field, MultipartFile, MultipartInterceptor, UploadedFile, parseMultipart } from "@multipart";

// The PNG signature carries 0x0d 0x0a (CRLF) bytes, so a correct parser must not split on them.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
const BOUNDARY = "----bytiumBoundary";
const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
const buildBody = (): ArrayBuffer => {
  const parts = [
    encode(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="avatar"; filename="cat.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    PNG,
    encode(`\r\n--${BOUNDARY}\r\nContent-Disposition: form-data; name="playerId"\r\n\r\n42\r\n--${BOUNDARY}--\r\n`),
  ];
  const total = parts.reduce((size, part) => size + part.length, 0);
  const body = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }

  return body.buffer;
};

interface MockResponse {
  statusCode: number;
  sentBody: string;
  writeHead(code: number): void;
  write(): void;
  send(data?: string): void;
}

interface MockRequest {
  address: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  setDataHandler(handler: (data: ArrayBuffer | string) => void, binary?: "binary"): void;
  setCancelHandler(handler: () => void): void;
}

const mockRequest = (body: ArrayBuffer): MockRequest => ({
  address: "127.0.0.1",
  path: "/upload",
  method: "POST",
  headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}`, "content-length": String(body.byteLength) },
  setDataHandler: (handler: (data: ArrayBuffer) => void, binary?: "binary"): void => {
    if (binary === "binary") handler(body);
  },
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

describe("multipart uploads", () => {
  let httpHandler: (request: unknown, response: unknown) => void;
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  beforeEach(() => {
    (global as unknown as { SetHttpHandler: unknown }).SetHttpHandler = (handler: typeof httpHandler) => {
      httpHandler = handler;
    };
  });

  it("should parse a multipart body into files and fields preserving binary bytes", () => {
    const parsed = parseMultipart(buildBody(), BOUNDARY);

    expect(parsed.fields).toEqual({ playerId: "42" });

    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].fieldName).toBe("avatar");
    expect(parsed.files[0].filename).toBe("cat.png");
    expect(parsed.files[0].mimetype).toBe("image/png");
    expect(Array.from(new Uint8Array(parsed.files[0].data))).toEqual(Array.from(PNG));
  });

  it("should read the field name even when filename precedes it in the header", () => {
    const body = new Uint8Array([
      ...encode(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; filename="cat.png"; name="avatar"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      ...PNG,
      ...encode(`\r\n--${BOUNDARY}--\r\n`),
    ]).buffer;
    const parsed = parseMultipart(body, BOUNDARY);

    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].fieldName).toBe("avatar");
    expect(parsed.files[0].filename).toBe("cat.png");
  });

  it("should expose the uploaded file and text field to the handler", async () => {
    @HttpController("/upload")
    class UploadController {
      @Post()
      @UseInterceptor(MultipartInterceptor)
      upload(@UploadedFile("avatar") file: MultipartFile, @Field("playerId") playerId: string) {
        return {
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          bytes: Array.from(new Uint8Array(file.data)),
          playerId,
        };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [UploadController],
    }).compile();
    const response = mockResponse();

    httpHandler(mockRequest(buildBody()), response);
    await flush();

    expect(JSON.parse(response.sentBody)).toEqual({
      filename: "cat.png",
      mimetype: "image/png",
      size: PNG.length,
      bytes: Array.from(PNG),
      playerId: "42",
    });

    await testingModule.close();
  });
});
