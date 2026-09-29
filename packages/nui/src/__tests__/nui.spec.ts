import { nui, NuiError } from "../index";

declare const global: {
  GetParentResourceName?: () => string;
  fetch: jest.Mock;
};

const jsonResponse = (payload: unknown) => ({ json: () => Promise.resolve(payload) });

describe("nui.call", () => {
  beforeEach(() => {
    global.GetParentResourceName = () => "my-resource";
    global.fetch = jest.fn();
  });

  it("should POST to the resource callback URL and resolve the returned value", async () => {
    global.fetch.mockResolvedValue(jsonResponse({ message: "Hello, Ada!" }));

    const result = await nui.call<{ message: string }>("nui-greet", { name: "Ada" });

    expect(result).toEqual({ message: "Hello, Ada!" });

    expect(global.fetch).toHaveBeenCalledWith("https://my-resource/nui-greet", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ name: "Ada" }),
    });
  });

  it("should throw a NuiError carrying the code and per-field errors from a serialized rejection", async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({
        __bytiumError: {
          __isErrorInstance: true,
          name: "ValidationException",
          message: "Validation failed",
          code: 400,
          errors: { name: ["Name must be at least 3 characters"] },
        },
      }),
    );

    const thrown = (await nui.call("nui-greet", { name: "ab" }).catch((error) => error)) as NuiError;

    expect(thrown).toBeInstanceOf(NuiError);
    expect(thrown.name).toBe("ValidationException");
    expect(thrown.code).toBe(400);
    expect(thrown.errors).toEqual({ name: ["Name must be at least 3 characters"] });
  });
});

describe("nui.on", () => {
  it("should invoke the handler only for a matching action and stop after unsubscribing", () => {
    const received: unknown[] = [];
    const unsubscribe = nui.on("open", (message) => received.push(message));

    window.postMessage({ action: "open", value: 1 }, "*");
    window.postMessage({ action: "close" }, "*");

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(received).toEqual([{ action: "open", value: 1 }]);

        unsubscribe();
        window.postMessage({ action: "open", value: 2 }, "*");

        setTimeout(() => {
          expect(received).toEqual([{ action: "open", value: 1 }]);
          resolve();
        }, 0);
      }, 0);
    });
  });
});
