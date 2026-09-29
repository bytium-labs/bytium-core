import { CookieOptions } from "@http/interfaces/cookie-options.interface";
import { NativeHttpResponse } from "@http/interfaces/native-http-response.interface";
import { serializeCookie } from "@http/utils/serialize-cookie.util";

/**
 * The outgoing HTTP response for the current invocation.
 */
export class HttpResponse {
  private statusCode = 200;
  private readonly headers: Record<string, string | string[]> = {};
  private headWritten = false;
  private finished = false;

  constructor(private readonly native: NativeHttpResponse) {}

  /** Whether the response has already been finished. */
  get sent(): boolean {
    return this.finished;
  }

  /** Sets the response status code. */
  status(code: number): this {
    this.statusCode = code;

    return this;
  }

  /** Sets a response header, replacing any existing one with the same name regardless of casing. */
  header(key: string, value: string | string[]): this {
    const existing = this.headerKey(key);

    if (existing) delete this.headers[existing];

    this.headers[key] = value;

    return this;
  }

  /** Appends a `Set-Cookie` header; each call adds another cookie to the response. */
  cookie(name: string, value: string, options?: CookieOptions): this {
    const existing = this.headers["Set-Cookie"];
    const cookies = Array.isArray(existing) ? existing : [];

    cookies.push(serializeCookie(name, value, options));

    return this.header("Set-Cookie", cookies);
  }

  /** Writes a chunk to the response body without finishing it. Writes the status/headers on first call. */
  write(chunk: string): this {
    this.ensureHead();
    this.native.write(chunk);

    return this;
  }

  /** Finishes the request, optionally writing a final body chunk. */
  send(body = ""): void {
    if (this.finished) return;

    this.ensureHead();
    this.finished = true;
    this.native.send(body);
  }

  /** Sends `payload` as a JSON response and finishes the request. */
  json(payload: unknown): void {
    if (!this.headerKey("Content-Type")) this.header("Content-Type", "application/json; charset=utf-8");

    this.send(JSON.stringify(payload));
  }

  private headerKey(key: string): string | undefined {
    const lowerKey = key.toLowerCase();

    return Object.keys(this.headers).find((existing) => existing.toLowerCase() === lowerKey);
  }

  private ensureHead(): void {
    if (this.headWritten) return;

    this.headWritten = true;
    this.native.writeHead(this.statusCode, this.headers);
  }
}
