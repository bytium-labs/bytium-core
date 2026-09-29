import "reflect-metadata";
import "../restore-timers";
import { UseGuard } from "@bytium-core/common";
import { Test } from "@bytium-core/testing";
import { Get, HttpController, HttpModule, Throttle, ThrottleGuard } from "@http";
import { NativeHttpRequest } from "@http/interfaces/native-http-request.interface";
import { NativeHttpResponse } from "@http/interfaces/native-http-response.interface";

const mockRequest = (method: string, path: string, address = "127.0.0.1"): NativeHttpRequest => ({
  address,
  path,
  method,
  headers: {},
  setDataHandler: (() => undefined) as NativeHttpRequest["setDataHandler"],
  setCancelHandler: () => undefined,
});
const mockResponse = (): NativeHttpResponse & { statusCode: number } => {
  const response = {
    statusCode: 0,
    writeHead: (code: number) => {
      response.statusCode = code;
    },
    write: (): void => undefined,
    send: (): void => undefined,
  };

  return response;
};

describe("HTTP throttling", () => {
  let httpHandler: (request: NativeHttpRequest, response: NativeHttpResponse) => void;
  let originalSetHttpHandler: typeof SetHttpHandler;
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  const fire = async (address?: string): Promise<number> => {
    const response = mockResponse();

    httpHandler(mockRequest("GET", "/limited", address), response);
    await flush();

    return response.statusCode;
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

  it("should allow up to the limit per IP and reject further requests with 429", async () => {
    @HttpController("")
    @UseGuard(ThrottleGuard)
    class RootController {
      @Get("/limited")
      @Throttle(2, 60000)
      limited() {
        return { ok: true };
      }
    }

    const testingModule = await Test.createTestingModule({
      imports: [HttpModule.forRoot()],
      controllers: [RootController],
    }).compile();

    expect(await fire("1.1.1.1")).toBe(200);
    expect(await fire("1.1.1.1")).toBe(200);
    expect(await fire("1.1.1.1")).toBe(429);

    expect(await fire("2.2.2.2")).toBe(200);

    await testingModule.close();
  });

  it("should allow requests again once the window has elapsed", async () => {
    jest.useFakeTimers();

    try {
      @HttpController("")
      @UseGuard(ThrottleGuard)
      class RootController {
        @Get("/limited")
        @Throttle(1, 60000)
        limited() {
          return { ok: true };
        }
      }

      const testingModule = await Test.createTestingModule({
        imports: [HttpModule.forRoot()],
        controllers: [RootController],
      }).compile();

      expect(await fire("1.1.1.1")).toBe(200);
      expect(await fire("1.1.1.1")).toBe(429);

      jest.advanceTimersByTime(61000);

      expect(await fire("1.1.1.1")).toBe(200);

      await testingModule.close();
    } finally {
      jest.useRealTimers();
    }
  });
});
