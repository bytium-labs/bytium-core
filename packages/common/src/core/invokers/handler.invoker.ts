import { Injectable } from "@core/decorators/injectable.decorator";
import { ForbiddenException } from "@core/exceptions/forbidden.exception";
import { HandlerPipeline } from "@core/interfaces/handler-pipeline.interface";
import { ParamDecoratorEntryInterface } from "@core/interfaces/param-decorator-entry.interface";
import { AnyExecutionContext } from "@core/types/any-execution-context.type";
import { BytiumMetadataEnum } from "@shared";

/**
 * Invokes a provider's handler method, resolving its arguments from the param decorators.
 */
@Injectable()
export class HandlerInvoker {
  readonly #pipelines = new WeakMap<object, Map<string, HandlerPipeline>>();
  readonly #classPipelines = new WeakMap<object, Map<string, HandlerPipeline>>();
  readonly #paramEntries = new WeakMap<object, Map<string, (ParamDecoratorEntryInterface | undefined)[]>>();

  /** Registers the interception pipeline for a handler. */
  registerPipeline(provider: object, methodName: string, pipeline: HandlerPipeline): void {
    let pipelinesByMethod = this.#pipelines.get(provider);

    if (!pipelinesByMethod) {
      pipelinesByMethod = new Map();
      this.#pipelines.set(provider, pipelinesByMethod);
    }

    pipelinesByMethod.set(methodName, pipeline);
  }

  /** Registers the interception pipeline for a handler, keyed by its class instead of a single instance. */
  registerClassPipeline(target: object, methodName: string, pipeline: HandlerPipeline): void {
    let pipelinesByMethod = this.#classPipelines.get(target);

    if (!pipelinesByMethod) {
      pipelinesByMethod = new Map();
      this.#classPipelines.set(target, pipelinesByMethod);
    }

    pipelinesByMethod.set(methodName, pipeline);
  }

  /** Runs the handler for an execution context and returns its result. */
  async invoke<TReturn = unknown>(context: AnyExecutionContext): Promise<TReturn> {
    const pipeline =
      this.#pipelines.get(context.provider)?.get(context.methodName) ??
      this.#classPipelines.get(context.provider.constructor)?.get(context.methodName);

    try {
      if (pipeline?.guards?.length) {
        for (const guard of pipeline.guards) {
          if (await guard.canActivate(context)) continue;

          throw new ForbiddenException();
        }
      }

      const runHandler = async (): Promise<unknown> => {
        const entries = this.#paramEntriesFor(Object.getPrototypeOf(context.provider), context.methodName);
        const args: unknown[] = [];

        for (let index = 0; index < entries.length; index++) {
          const entry = entries[index];

          args[index] = entry ? await entry.factory(entry.data, context) : undefined;
        }

        if (pipeline?.pipes?.length || pipeline?.paramPipes) {
          for (let index = 0; index < args.length; index++) {
            for (const pipe of pipeline.pipes ?? []) {
              args[index] = await pipe.transform(args[index]);
            }

            for (const pipe of pipeline.paramPipes?.[index] ?? []) {
              args[index] = await pipe.transform(args[index]);
            }
          }
        }

        // FiveM for GTA V Enhanced workaround - microtask-defer sync handler throw
        await Promise.resolve();

        const method = (context.provider as Record<string, (...args: unknown[]) => unknown>)[context.methodName];

        return method.apply(context.provider, args);
      };
      const chain = (pipeline?.interceptors ?? []).reduceRight<() => Promise<unknown>>(
        (next, interceptor) => () => interceptor.intercept(context, next),
        runHandler,
      );

      return (await chain()) as TReturn;
    } catch (error) {
      const matched = pipeline?.filters?.find(
        ({ exceptions }) => exceptions.length === 0 || exceptions.some((type) => error instanceof type),
      );

      if (matched) {
        return (await matched.filter.catch(error, context)) as TReturn;
      }

      throw error;
    }
  }

  /**
   * Runs the handler synchronously - argument resolution and the method call happen in the same task,
   * so the handler's synchronous prefix (e.g. `deferrals.defer()` / `CancelEvent()`) executes before
   * control returns to the runtime. The handler may still be async; its returned promise (the async
   * tail) is handed back to the caller to observe. Guards, param factories and pipes must be
   * synchronous here - anything returning a promise throws, since it would break the same-task guarantee.
   */
  invokeSync<TReturn = unknown>(context: AnyExecutionContext): TReturn {
    // FiveM for GTA V Enhanced workaround - synchronous deferrals / CancelEvent
    const pipeline =
      this.#pipelines.get(context.provider)?.get(context.methodName) ??
      this.#classPipelines.get(context.provider.constructor)?.get(context.methodName);

    if (pipeline?.interceptors?.length) {
      throw new Error(
        `Handler "${context.methodName}" runs in sync mode but has interceptors, which are asynchronous and unsupported in sync mode.`,
      );
    }

    if (pipeline?.guards?.length) {
      for (const guard of pipeline.guards) {
        const allowed = guard.canActivate(context);

        if (this.#isThenable(allowed)) {
          throw new Error(`Guard on "${context.methodName}" is async, which is unsupported in sync mode.`);
        }

        if (allowed) continue;

        throw new ForbiddenException();
      }
    }

    const entries = this.#paramEntriesFor(Object.getPrototypeOf(context.provider), context.methodName);
    const args: unknown[] = [];

    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];

      if (!entry) {
        args[index] = undefined;

        continue;
      }

      const value = entry.factory(entry.data, context);

      if (this.#isThenable(value)) {
        throw new Error(`Param decorator on "${context.methodName}" is async, which is unsupported in sync mode.`);
      }

      args[index] = value;
    }

    if (pipeline?.pipes?.length || pipeline?.paramPipes) {
      for (let index = 0; index < args.length; index++) {
        for (const pipe of [...(pipeline.pipes ?? []), ...(pipeline.paramPipes?.[index] ?? [])]) {
          const transformed = pipe.transform(args[index]);

          if (this.#isThenable(transformed)) {
            throw new Error(`Pipe on "${context.methodName}" is async, which is unsupported in sync mode.`);
          }

          args[index] = transformed;
        }
      }
    }

    const method = (context.provider as Record<string, (...args: unknown[]) => unknown>)[context.methodName];

    return method.apply(context.provider, args) as TReturn;
  }

  #isThenable(value: unknown): value is Promise<unknown> {
    return !!value && typeof (value as { then?: unknown }).then === "function";
  }

  #paramEntriesFor(prototype: object, methodName: string): (ParamDecoratorEntryInterface | undefined)[] {
    let byMethod = this.#paramEntries.get(prototype);

    if (!byMethod) {
      byMethod = new Map();
      this.#paramEntries.set(prototype, byMethod);
    }

    let entries = byMethod.get(methodName);

    if (!entries) {
      entries =
        (Reflect.getMetadata(BytiumMetadataEnum.PARAM_DECORATORS, prototype, methodName) as
          (ParamDecoratorEntryInterface | undefined)[] | undefined) ?? [];
      byMethod.set(methodName, entries);
    }

    return entries;
  }
}
