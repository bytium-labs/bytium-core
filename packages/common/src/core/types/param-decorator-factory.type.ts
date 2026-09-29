import { AnyExecutionContext } from "@core/types/any-execution-context.type";

/**
 * The factory a param decorator runs at invocation time to compute the value bound to its parameter.
 */
export type ParamDecoratorFactory<
  TData = unknown,
  TReturn = unknown,
  TContext extends AnyExecutionContext = AnyExecutionContext,
> = (data: TData, context: TContext) => TReturn | Promise<TReturn>;
