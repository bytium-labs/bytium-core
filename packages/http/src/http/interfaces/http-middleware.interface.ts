import { HttpRequest } from "@http/models/http-request.model";
import { HttpResponse } from "@http/models/http-response.model";

/**
 * Transport-level middleware run in order on the raw request before routing (CORS, logging, rate limiting, ...).
 */
export interface HttpMiddleware {
  use(request: HttpRequest, response: HttpResponse, next: () => Promise<void>): void | Promise<void>;
}
