import { AnyExecutionContext } from "@core/types/any-execution-context.type";

/**
 * Handles an exception thrown while running a handler.
 */
export interface ExceptionFilter {
  catch(exception: unknown, context: AnyExecutionContext): unknown | Promise<unknown>;
}
