import { createParamDecorator } from "@bytium-core/common/server";
import { BadRequestException } from "@http/exceptions/bad-request.exception";
import { assertHttpContext } from "@http/utils/assert-http-context.util";

/**
 * The request body, parsed by its `Content-Type`: `application/json` yields an object (malformed JSON throws
 * a 400), `application/x-www-form-urlencoded` yields an object, a binary route yields the raw `ArrayBuffer`,
 * and anything else yields the raw string. An empty body is `{}` (or `""` for a `text/*` type).
 */
export const Body = createParamDecorator((_data, context) => {
  const { request } = assertHttpContext(context, "@Body()");

  if (typeof request.body !== "string") return request.body;

  const contentType = (request.headers["content-type"] ?? "").toLowerCase();

  if (!request.body) return contentType.startsWith("text/") ? "" : {};

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(request.body);
    } catch (error) {
      throw new BadRequestException((error as Error).message || "Malformed body");
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form: Record<string, string> = {};

    new URLSearchParams(request.body).forEach((value, key) => {
      form[key] = value;
    });

    return form;
  }

  return request.body;
});
