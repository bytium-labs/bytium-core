import { AnyExecutionContext } from "@core/types/any-execution-context.type";

/**
 * Wraps a handler invocation to run logic around it or transform its result.
 */
export interface Interceptor {
  intercept(context: AnyExecutionContext, next: () => Promise<unknown>): Promise<unknown>;
}
