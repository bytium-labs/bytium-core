import "reflect-metadata";
import { BytiumMetadataEnum, sensitive } from "@bytium-core/common";
import { HttpRequest } from "@http/models/http-request.model";
import { HttpRequestLogLevelEnum } from "@http/enums/http-request-log-level.enum";
import { NativeHttpRequest } from "@http/interfaces/native-http-request.interface";
import { RequestLogBuilder } from "@http/builders/request-log.builder";

describe("RequestLogBuilder", () => {
  const noMasks: string[] = [];
  const declareRoute = (maskedPaths?: string[]) => {
    class AccountsController {
      create(_dto: object) {}
    }

    const pipes = maskedPaths
      ? [
          sensitive(
            { "~standard": { version: 1, vendor: "test", validate: (value: unknown) => ({ value }) } },
            maskedPaths,
          ),
        ]
      : [];

    Reflect.defineMetadata(
      BytiumMetadataEnum.PARAM_DECORATORS,
      [{ factory: () => undefined, data: undefined, pipes }],
      AccountsController.prototype,
      "create",
    );

    return AccountsController;
  };
  const declareRequest = (body: string | ArrayBuffer = "", contentType = "application/json"): HttpRequest =>
    new HttpRequest(
      {
        address: "127.0.0.1:50000",
        path: "/accounts?page=2&token=abc",
        method: "POST",
        headers: { "Content-Type": contentType, Authorization: "Bearer token", "X-Trace": "t-1" },
        setDataHandler: (() => undefined) as NativeHttpRequest["setDataHandler"],
        setCancelHandler: () => undefined,
      },
      { id: "7" },
      { page: "2", token: "abc" },
      body,
    );

  it("should return nothing at the LEAN level", () => {
    expect(
      RequestLogBuilder.requestFields(
        declareRequest(),
        declareRoute(),
        "create",
        HttpRequestLogLevelEnum.LEAN,
        noMasks,
        noMasks,
      ),
    ).toEqual({});
  });

  it("should carry the transport fields without the body at the META level", () => {
    const fields = RequestLogBuilder.requestFields(
      declareRequest("ignored"),
      declareRoute(),
      "create",
      HttpRequestLogLevelEnum.META,
      noMasks,
      noMasks,
    );

    expect(fields.url).toBe("/accounts?page=2&token=[REDACTED]");
    expect(fields.params).toEqual({ id: "7" });
    expect(fields.query).toEqual({ page: "2", token: "[REDACTED]" });
    expect(fields.headers).toEqual({
      "content-type": "application/json",
      authorization: "[REDACTED]",
      "x-trace": "t-1",
    });
    expect(fields).not.toHaveProperty("body");
  });

  it("should mask the body by schema paths, built-in key names and the operator mask list", () => {
    const request = new HttpRequest(
      {
        address: "1",
        path: "/x",
        method: "POST",
        headers: {},
        setDataHandler: (() => undefined) as NativeHttpRequest["setDataHandler"],
        setCancelHandler: () => undefined,
      },
      {},
      {},
      JSON.stringify({ login: "lilabyte", password: "hunter2", card: { number: "4111" }, ssn: "123-45" }),
    );
    const fields = RequestLogBuilder.requestFields(
      request,
      declareRoute(["card.number"]),
      "create",
      HttpRequestLogLevelEnum.FULL,
      noMasks,
      ["ssn"],
    );

    expect(fields.body).toEqual({
      login: "lilabyte",
      password: "[REDACTED]",
      card: { number: "[REDACTED]" },
      ssn: "[REDACTED]",
    });
  });

  it("should omit the body field entirely when the request carries no body", () => {
    const emptyStringFields = RequestLogBuilder.requestFields(
      declareRequest(""),
      declareRoute(),
      "create",
      HttpRequestLogLevelEnum.FULL,
      noMasks,
      noMasks,
    );
    const emptyBufferFields = RequestLogBuilder.requestFields(
      declareRequest(new ArrayBuffer(0)),
      declareRoute(),
      "create",
      HttpRequestLogLevelEnum.FULL,
      noMasks,
      noMasks,
    );

    expect(emptyStringFields).not.toHaveProperty("body");

    expect(emptyBufferFields).not.toHaveProperty("body");
  });

  it("should redact the whole body when a parameter carries a whole-value Sensitive mask", () => {
    class AccountsController {
      create(_dto: object) {}
    }

    Reflect.defineMetadata(BytiumMetadataEnum.SENSITIVE_PARAMS, { 0: true }, AccountsController.prototype, "create");

    const fields = RequestLogBuilder.requestFields(
      declareRequest(JSON.stringify({ login: "lilabyte" })),
      AccountsController,
      "create",
      HttpRequestLogLevelEnum.FULL,
      noMasks,
      noMasks,
    );

    expect(fields.body).toBe("[REDACTED]");
  });

  it("should merge dot paths from the Sensitive decorator into the body masks", () => {
    class AccountsController {
      create(_dto: object) {}
    }

    Reflect.defineMetadata(
      BytiumMetadataEnum.SENSITIVE_PARAMS,
      { 0: ["password"] },
      AccountsController.prototype,
      "create",
    );

    const fields = RequestLogBuilder.requestFields(
      declareRequest(JSON.stringify({ login: "lilabyte", password: "hunter2" })),
      AccountsController,
      "create",
      HttpRequestLogLevelEnum.FULL,
      noMasks,
      noMasks,
    );

    expect(fields.body).toEqual({ login: "lilabyte", password: "[REDACTED]" });
  });

  it("should extend the header and key masks with the operator mask lists independently", () => {
    const fields = RequestLogBuilder.requestFields(
      declareRequest(),
      declareRoute(),
      "create",
      HttpRequestLogLevelEnum.META,
      ["x-trace"],
      ["page"],
    );

    expect((fields.headers as Record<string, string>)["x-trace"]).toBe("[REDACTED]");
    expect((fields.query as Record<string, string>).page).toBe("[REDACTED]");
    expect((fields.query as Record<string, string>)["x-trace"]).toBeUndefined();
  });

  it("should mask before capping so a truncated body never leaks a masked value", () => {
    const request = new HttpRequest(
      {
        address: "1",
        path: "/x",
        method: "POST",
        headers: {},
        setDataHandler: (() => undefined) as NativeHttpRequest["setDataHandler"],
        setCancelHandler: () => undefined,
      },
      {},
      {},
      JSON.stringify({ password: "hunter2", padding: "x".repeat(5000) }),
    );
    const body = RequestLogBuilder.requestFields(
      request,
      declareRoute(),
      "create",
      HttpRequestLogLevelEnum.FULL,
      noMasks,
      noMasks,
    ).body as string;

    expect(typeof body).toBe("string");
    expect(body.endsWith("...[truncated]")).toBe(true);
    expect(body).toContain("[REDACTED]");
    expect(body).not.toContain("hunter2");
  });

  it("should parse and mask an urlencoded body", () => {
    const fields = RequestLogBuilder.requestFields(
      declareRequest("login=lilabyte&password=hunter2", "application/x-www-form-urlencoded"),
      declareRoute(),
      "create",
      HttpRequestLogLevelEnum.FULL,
      noMasks,
      noMasks,
    );

    expect(fields.body).toEqual({ login: "lilabyte", password: "[REDACTED]" });
  });

  it("should replace an unparsable body with a size placeholder instead of logging it raw", () => {
    const fields = RequestLogBuilder.requestFields(
      declareRequest("some opaque text with a secret inside", "text/plain"),
      declareRoute(),
      "create",
      HttpRequestLogLevelEnum.FULL,
      noMasks,
      noMasks,
    );

    expect(fields.body).toBe("[unparsed body 37B]");
  });

  it("should replace a binary body with a size placeholder", () => {
    const fields = RequestLogBuilder.requestFields(
      declareRequest(new ArrayBuffer(16)),
      declareRoute(),
      "create",
      HttpRequestLogLevelEnum.FULL,
      noMasks,
      noMasks,
    );

    expect(fields.body).toBe("[binary 16B]");
  });

  it("should mask the response headers from the META level and return nothing at LEAN", () => {
    const headers = { "content-type": "application/json", "set-cookie": "session=1", "x-build": "7" };

    expect(RequestLogBuilder.responseHeaders(headers, HttpRequestLogLevelEnum.LEAN, noMasks)).toEqual({});

    expect(RequestLogBuilder.responseHeaders(headers, HttpRequestLogLevelEnum.META, ["x-build"])).toEqual({
      headers: { "content-type": "application/json", "set-cookie": "[REDACTED]", "x-build": "[REDACTED]" },
    });
  });
});
