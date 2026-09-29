import { HttpExecutionContext, HttpRequest } from "@bytium-core/http";

/** Returns the {@link HttpRequest} from an execution context, or `undefined` when it is not an HTTP one. */
export function httpRequestOf(context: { type: string }): HttpRequest | undefined {
  return context.type === "HTTP" ? (context as unknown as HttpExecutionContext).request : undefined;
}
