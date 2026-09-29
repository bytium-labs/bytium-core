import { AnyExecutionContext } from "@core/types/any-execution-context.type";
import { ParamDecoratorFactory } from "@core/types/param-decorator-factory.type";
import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { StandardSchemaV1 } from "@core/interfaces/standard-schema.interface";
import { ConstructorType } from "@shared";

type ParamPipe = ConstructorType | PipeTransform | StandardSchemaV1;

/**
 * Signature of `createParamDecorator`, parameterized by the execution context it narrows.
 */
export type CreateParamDecorator<TContext extends AnyExecutionContext = AnyExecutionContext> = <
  TData = unknown,
  TReturn = unknown,
>(
  factory: ParamDecoratorFactory<TData, TReturn, TContext>,
) => (data?: TData | ParamPipe, ...pipes: ParamPipe[]) => ParameterDecorator;
