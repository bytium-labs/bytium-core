import { NativeHttpRequest } from "@http/interfaces/native-http-request.interface";
import { clientIp } from "@http/utils/client-ip.util";
import { normalizeHeaders } from "@http/utils/normalize-headers.util";

/**
 * The incoming HTTP request for the current invocation.
 */
export class HttpRequest {
  private readonly normalizedHeaders: Record<string, string>;

  constructor(
    private readonly native: NativeHttpRequest,

    /** Path parameters matched from the route pattern. */
    public readonly params: Record<string, string>,

    /** Parsed query-string values. */
    public readonly query: Record<string, string | string[]>,

    /** The request body: the raw `ArrayBuffer` for binary routes, parsed JSON when it parses, else the raw string. */
    public readonly body: string | ArrayBuffer,
  ) {
    this.normalizedHeaders = normalizeHeaders(native.headers);
  }

  /** The sender's IP address, without the transport's source port. */
  get address(): string {
    return clientIp(this.native.address);
  }

  /** The request path. */
  get path(): string {
    return this.native.path;
  }

  /** The HTTP method. */
  get method(): string {
    return this.native.method;
  }

  /** The request headers, with lowercased keys. */
  get headers(): Record<string, string> {
    return this.normalizedHeaders;
  }
}
