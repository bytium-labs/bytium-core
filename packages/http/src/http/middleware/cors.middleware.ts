import { ConstructorType, Injectable } from "@bytium-core/common";
import { CorsOptions } from "@http/interfaces/cors-options.interface";
import { HttpMiddleware } from "@http/interfaces/http-middleware.interface";
import { HttpRequest } from "@http/models/http-request.model";
import { HttpResponse } from "@http/models/http-response.model";

const DEFAULT_METHODS = "GET,HEAD,PUT,PATCH,POST,DELETE";

/** Enables CORS by answering preflight requests and adding the `Access-Control-*` headers to every response. */
export function cors(options: CorsOptions = {}): ConstructorType {
  const allowedOrigins = Array.isArray(options.origin) ? options.origin : [options.origin ?? "*"];
  const allowAnyOrigin = allowedOrigins.includes("*");
  const methods = join(options.methods) ?? DEFAULT_METHODS;
  const allowedHeaders = join(options.allowedHeaders);

  @Injectable()
  class CorsMiddleware implements HttpMiddleware {
    async use(request: HttpRequest, response: HttpResponse, next: () => Promise<void>): Promise<void> {
      const allowOrigin = this.resolveOrigin(request.headers["origin"]);

      if (allowOrigin) {
        response.header("Access-Control-Allow-Origin", allowOrigin);

        if (allowOrigin !== "*") response.header("Vary", "Origin");
      }

      response.header("Access-Control-Allow-Methods", methods);
      response.header(
        "Access-Control-Allow-Headers",
        allowedHeaders ?? request.headers["access-control-request-headers"] ?? "*",
      );

      if (options.credentials) response.header("Access-Control-Allow-Credentials", "true");

      if (options.maxAge !== undefined) response.header("Access-Control-Max-Age", String(options.maxAge));

      if (request.method.toUpperCase() === "OPTIONS") {
        response.status(204).send();

        return;
      }

      await next();
    }

    private resolveOrigin(requestOrigin?: string): string | undefined {
      // Credentials forbid the "*" wildcard, so a permissive config must echo the caller's origin instead.
      if (allowAnyOrigin) return options.credentials ? requestOrigin : "*";

      return requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : undefined;
    }
  }

  return CorsMiddleware;
}

function join(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value.join(",") : value;
}
