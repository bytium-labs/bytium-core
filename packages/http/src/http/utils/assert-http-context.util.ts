import { HttpExecutionContext } from "@http/interfaces/http-execution-context.interface";

/** Narrows an execution context to an {@link HttpExecutionContext}, throwing if the handler is not an HTTP one. */
export function assertHttpContext(context: { type: string }, decorator: string): HttpExecutionContext {
  if (context.type !== "HTTP") {
    throw new Error(`${decorator} is only available in HTTP handlers - the current handler is "${context.type}".`);
  }

  return context as unknown as HttpExecutionContext;
}
