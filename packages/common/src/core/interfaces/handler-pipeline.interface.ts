import { CanActivate } from "@core/interfaces/can-activate.interface";
import { ExceptionFilter } from "@core/interfaces/exception-filter.interface";
import { Interceptor } from "@core/interfaces/interceptor.interface";
import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { ConstructorType } from "@shared";

/**
 * The resolved interception chain for one handler method.
 */
export interface HandlerPipeline {
  /** Resolved guards to run before the handler. */
  guards?: CanActivate[];

  /** Resolved handler-level pipes applied to every argument. */
  pipes?: PipeTransform[];

  /** Resolved per-parameter pipes, indexed by parameter position. */
  paramPipes?: (PipeTransform[] | undefined)[];

  /** Resolved interceptors wrapping the invocation. */
  interceptors?: Interceptor[];

  /** Resolved exception filters with their `@Catch` exception types (empty = catch-all). */
  filters?: { filter: ExceptionFilter; exceptions: ConstructorType[] }[];
}
