import { ParamDecoratorEntryInterface } from "@core/interfaces/param-decorator-entry.interface";
import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { StandardSchemaV1 } from "@core/interfaces/standard-schema.interface";
import { ParamDecoratorFactory } from "@core/types/param-decorator-factory.type";
import { AnyExecutionContext } from "@core/types/any-execution-context.type";
import { BytiumMetadataEnum, ConstructorType } from "@shared";

type ParamPipe = ConstructorType | PipeTransform | StandardSchemaV1;

function isPipe(value: unknown): value is ParamPipe {
  return (
    typeof value === "function" ||
    (typeof value === "object" && value !== null && ("transform" in value || "~standard" in value))
  );
}

/**
 * Builds a param decorator from a factory. The decorator stamps the factory onto the
 * handler method's `PARAM_DECORATORS` metadata at its parameter index; {@link HandlerInvoker}
 * runs it against the live execution context when the handler fires.
 *
 * The first argument is the decorator's data (e.g. an index or name) unless it is a pipe or a
 * Standard Schema, in which case it is treated as a pipe - so both `@Body(schema)` and
 * `@Query("age", schema)` work.
 *
 * Re-typed per environment by `@bytium-core/server` and `@bytium-core/client` so the factory
 * receives the environment-correct execution context.
 *
 * @example
 * ```ts
 * export const Args = createParamDecorator((_, ctx) => {
 *   if (!("args" in ctx)) throw new Error(`@Args() is not available in "${ctx.type}" handlers.`);
 *   return ctx.args;
 * });
 * ```
 */
export function createParamDecorator<
  TData = unknown,
  TReturn = unknown,
  TContext extends AnyExecutionContext = AnyExecutionContext,
>(
  factory: ParamDecoratorFactory<TData, TReturn, TContext>,
): (data?: TData | ParamPipe, ...pipes: ParamPipe[]) => ParameterDecorator {
  return (data?: TData | ParamPipe, ...pipes: ParamPipe[]): ParameterDecorator =>
    (target, propertyKey, parameterIndex) => {
      if (propertyKey === undefined) return;

      const dataIsPipe = isPipe(data);
      const entries: (ParamDecoratorEntryInterface | undefined)[] =
        Reflect.getOwnMetadata(BytiumMetadataEnum.PARAM_DECORATORS, target, propertyKey) ?? [];

      entries[parameterIndex] = {
        factory: factory as ParamDecoratorEntryInterface["factory"],
        data: dataIsPipe ? undefined : data,
        pipes: dataIsPipe ? [data, ...pipes] : pipes,
      };

      Reflect.defineMetadata(BytiumMetadataEnum.PARAM_DECORATORS, entries, target, propertyKey);
    };
}
