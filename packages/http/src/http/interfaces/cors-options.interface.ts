/**
 * Options for the {@link cors} middleware.
 */
export interface CorsOptions {
  /** Allowed origin(s). A request whose `Origin` is not allowed receives no `Access-Control-Allow-Origin`. Defaults to `*`. */
  origin?: string | string[];

  /** Allowed methods sent as `Access-Control-Allow-Methods`. Defaults to the common set. */
  methods?: string | string[];

  /** Allowed request headers sent as `Access-Control-Allow-Headers`. Defaults to echoing the requested headers. */
  allowedHeaders?: string | string[];

  /** When `true`, sends `Access-Control-Allow-Credentials: true`. */
  credentials?: boolean;

  /** Seconds the preflight result may be cached, sent as `Access-Control-Max-Age`. */
  maxAge?: number;
}
