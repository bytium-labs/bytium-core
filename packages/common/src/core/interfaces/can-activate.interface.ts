import { AnyExecutionContext } from "@core/types/any-execution-context.type";

/**
 * A guard decides whether a handler may run.
 */
export interface CanActivate {
  canActivate(context: AnyExecutionContext): boolean | Promise<boolean>;
}
