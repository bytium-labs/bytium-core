import { HttpRequest } from "@http/models/http-request.model";
import { HttpResponse } from "@http/models/http-response.model";

/**
 * Execution context for an HTTP handler, read by guards, interceptors, and filters.
 */
export interface HttpExecutionContext {
  /** Discriminator identifying the HTTP surface. */
  type: "HTTP";

  /** The controller instance handling the request. */
  provider: object;

  /** The handler method's name. */
  methodName: string;

  /** The incoming request. */
  request: HttpRequest;

  /** The outgoing response. */
  response: HttpResponse;
}
