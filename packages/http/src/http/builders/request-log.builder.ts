import { BytiumMetadataEnum, ConstructorType } from "@bytium-core/common";
import { SENSITIVE_SCHEMA_PATHS } from "@bytium-core/common/internal/shared/consts/sensitive-schema-paths.const";
import { maskValueAtPaths } from "@bytium-core/common/internal/shared/utils/sensitive-paths.utils";
import { HttpRequest } from "@http/models/http-request.model";
import { HttpRequestLogLevelEnum } from "@http/enums/http-request-log-level.enum";
import { MAX_LOGGED_BODY_LENGTH } from "@http/consts/max-logged-body-length.const";
import { REDACTED_HEADERS } from "@http/consts/redacted-headers.const";
import { REDACTED_KEY_NAMES } from "@http/consts/redacted-key-names.const";

export class RequestLogBuilder {
  static requestFields(
    request: HttpRequest,
    controllerToken: ConstructorType,
    methodName: string,
    level: HttpRequestLogLevelEnum,
    maskedHeaders: readonly string[],
    maskedKeys: readonly string[],
  ): Record<string, unknown> {
    if (level === HttpRequestLogLevelEnum.LEAN) {
      return {};
    }

    const query = this.#maskRecordByKeyNames({ ...request.query }, maskedKeys);
    const fields: Record<string, unknown> = {
      url: this.#maskedUrl(request.path, query),
      query,
      params: this.#maskRecordByKeyNames({ ...request.params }, maskedKeys),
      headers: this.#maskHeaders(request.headers, maskedHeaders),
    };

    if (level === HttpRequestLogLevelEnum.FULL && this.#hasBody(request.body)) {
      const bodyMask = this.#bodyMaskFor(controllerToken, methodName);

      fields.body =
        bodyMask === true
          ? "[REDACTED]"
          : this.#loggableBody(request.body, request.headers["content-type"] ?? "", bodyMask, maskedKeys);
    }

    return fields;
  }

  static responseHeaders(
    headers: Record<string, string | string[]>,
    level: HttpRequestLogLevelEnum,
    maskedHeaders: readonly string[],
  ): Record<string, unknown> {
    if (level === HttpRequestLogLevelEnum.LEAN) {
      return {};
    }

    return { headers: this.#maskHeaders(headers, maskedHeaders) };
  }

  // url rebuilt from the masked query (raw path carries the raw query string)
  static #maskedUrl(path: string, maskedQuery: Record<string, unknown>): string {
    const [pathname] = path.split("?");
    const pairs = Object.entries(maskedQuery).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((item) => `${key}=${String(item)}`) : [`${key}=${String(value)}`],
    );

    return pairs.length ? `${pathname}?${pairs.join("&")}` : pathname;
  }

  static #maskHeaders<TValue>(
    headers: Record<string, TValue>,
    maskedHeaders: readonly string[],
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [
        key,
        REDACTED_HEADERS.has(key.toLowerCase()) || maskedHeaders.includes(key.toLowerCase()) ? "[REDACTED]" : value,
      ]),
    );
  }

  static #maskRecordByKeyNames(
    record: Record<string, unknown>,
    maskedKeys: readonly string[],
  ): Record<string, unknown> {
    for (const key of Object.keys(record)) {
      if (REDACTED_KEY_NAMES.has(key.toLowerCase()) || maskedKeys.includes(key.toLowerCase())) {
        record[key] = "[REDACTED]";
      }
    }

    return record;
  }

  static #maskDeepByKeyNames(value: unknown, maskedKeys: readonly string[]): void {
    if (value === null || typeof value !== "object") {
      return;
    }

    for (const key of Object.keys(value)) {
      if (REDACTED_KEY_NAMES.has(key.toLowerCase()) || maskedKeys.includes(key.toLowerCase())) {
        Reflect.set(value, key, "[REDACTED]");

        continue;
      }

      this.#maskDeepByKeyNames(Reflect.get(value, key), maskedKeys);
    }
  }

  // positions cannot be mapped to request parts, so a whole-value mask redacts the whole body
  static #bodyMaskFor(controllerToken: ConstructorType, methodName: string): true | string[] {
    const decorated = (Reflect.getMetadata(
      BytiumMetadataEnum.SENSITIVE_PARAMS,
      controllerToken.prototype,
      methodName,
    ) ?? {}) as Record<number, true | string[]>;
    const decoratedMasks = Object.values(decorated);

    if (decoratedMasks.includes(true)) {
      return true;
    }

    const entries =
      (Reflect.getMetadata(BytiumMetadataEnum.PARAM_DECORATORS, controllerToken.prototype, methodName) as
        ({ pipes?: unknown[] } | undefined)[] | undefined) ?? [];
    const schemaPaths = entries.flatMap(
      (entry) =>
        entry?.pipes?.flatMap((pipe) =>
          pipe !== null && (typeof pipe === "object" || typeof pipe === "function")
            ? ((Reflect.get(pipe, SENSITIVE_SCHEMA_PATHS) as string[] | undefined) ?? [])
            : [],
        ) ?? [],
    );

    return [...decoratedMasks.flatMap((mask) => (mask === true ? [] : mask)), ...schemaPaths];
  }

  static #hasBody(body: unknown): boolean {
    if (body === undefined || body === null || body === "") {
      return false;
    }

    return !(body instanceof ArrayBuffer && body.byteLength === 0);
  }

  static #parsedBody(body: string, contentType: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      return contentType.includes("application/x-www-form-urlencoded")
        ? Object.fromEntries(new URLSearchParams(body))
        : undefined;
    }
  }

  static #loggableBody(
    body: unknown,
    contentType: string,
    maskedPaths: string[],
    maskedKeys: readonly string[],
  ): unknown {
    if (body instanceof ArrayBuffer) {
      return `[binary ${body.byteLength}B]`;
    }

    let value = body;

    // unparseable body cannot be masked, so it is never logged raw
    if (typeof body === "string") {
      value = this.#parsedBody(body, contentType);

      if (value === null || typeof value !== "object") {
        return `[unparsed body ${body.length}B]`;
      }
    }

    try {
      const snapshot = JSON.parse(JSON.stringify(value)) as unknown;

      maskValueAtPaths(snapshot, maskedPaths);
      this.#maskDeepByKeyNames(snapshot, maskedKeys);

      const serialized = JSON.stringify(snapshot);

      return serialized.length > MAX_LOGGED_BODY_LENGTH
        ? `${serialized.slice(0, MAX_LOGGED_BODY_LENGTH)}...[truncated]`
        : snapshot;
    } catch {
      return "[unserializable]";
    }
  }
}
