import { ErrorSerializer } from "@core/serializers/error.serializer";
import { boundaryLogManagerInstance } from "@invocation/managers/boundary-log.manager";
import { appendCorrelationEnvelope, extractCorrelationEnvelope } from "@invocation/utils/correlation-envelope.utils";
import { InvocationContext } from "@invocation/contexts/invocation.context";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";
import { instanceOfTransferable } from "@core/decorators/transferable.decorator";
import { Logger } from "@logger";

export class TransferableMarshaler {
  readonly #logger = new Logger("bytium-core");

  wrapForOwner<T extends object>(instance: T): T {
    // stable per-property wrappers (proxy.method === proxy.method)
    const wrappers = new Map<string | symbol, (...args: unknown[]) => unknown>();

    return new Proxy(instance, {
      get: (target, property) => {
        // no receiver: an accessor must run with `this` = the real instance, or #private brand checks fail
        const value = Reflect.get(target, property);

        if (typeof value !== "function") {
          return value;
        }

        let wrapper = wrappers.get(property);

        if (!wrapper) {
          wrapper = (...rawArgs: unknown[]) => {
            const { args, correlationId } = extractCorrelationEnvelope(rawArgs);
            const inboundArgs = args.map((arg) => this.#wrapInbound(arg));
            const method = Reflect.get(target, property) as (...a: unknown[]) => unknown;
            const handlerLabel = `${target.constructor.name}.${String(property)}`;
            const invokedBy = GetInvokingResource();

            return invocationContextManagerInstance.run(
              () => ({
                correlationId: correlationId ?? crypto.randomUUID(),
                type: "TRANSFERABLE",
                handler: handlerLabel,
                invokedBy,
              }),
              () => {
                const boundaryLogged = boundaryLogManagerInstance.shouldLog("TRANSFERABLE");

                if (boundaryLogged) {
                  this.#logger.log(`Executing @Transferable ${handlerLabel} invoked by "${invokedBy}"`);
                }

                const startedAt = Date.now();
                const logResponse = (outcome: "done" | "error") => {
                  if (outcome === "done" && !boundaryLogged) {
                    return;
                  }

                  const durationMs = Date.now() - startedAt;

                  InvocationContext.scoped({ response: { outcome, durationMs } }, () =>
                    this.#logger.log(`@Transferable ${handlerLabel} -> ${outcome} (${durationMs}ms)`),
                  );
                };

                try {
                  const result = method.apply(target, inboundArgs);

                  if (result instanceof Promise) {
                    return result.then(
                      (resolved) => {
                        logResponse("done");

                        return this.#wrapOutbound(resolved);
                      },
                      (error) => {
                        logResponse("error");

                        return ErrorSerializer.serialize(error);
                      },
                    );
                  }

                  logResponse("done");

                  return this.#wrapOutbound(result);
                } catch (error) {
                  logResponse("error");

                  return ErrorSerializer.serialize(error);
                }
              },
            );
          };
          wrappers.set(property, wrapper);
        }

        return wrapper;
      },
    });
  }

  wrapForConsumer<T extends object>(instance: T): T {
    // stable per-property wrappers (proxy.method === proxy.method)
    const wrappers = new Map<string | symbol, (...args: unknown[]) => unknown>();

    return new Proxy(instance, {
      get: (target, property) => {
        // no receiver: an accessor must run with `this` = the real instance, or #private brand checks fail
        const value = Reflect.get(target, property);

        if (typeof value !== "function") {
          return value;
        }

        let wrapper = wrappers.get(property);

        if (!wrapper) {
          wrapper = (...args: unknown[]) => {
            const outboundArgs = appendCorrelationEnvelope(args.map((arg) => this.#wrapOutbound(arg)));
            const method = Reflect.get(target, property) as (...a: unknown[]) => unknown;
            const result = method.apply(target, outboundArgs);

            if (ErrorSerializer.isSerialized(result)) {
              throw ErrorSerializer.deserialize(result);
            }

            if (result instanceof Promise) {
              return result.then((resolved) => {
                if (ErrorSerializer.isSerialized(resolved)) {
                  throw ErrorSerializer.deserialize(resolved);
                }

                return this.#wrapInbound(resolved);
              });
            }

            return this.#wrapInbound(result);
          };
          wrappers.set(property, wrapper);
        }

        return wrapper;
      },
    });
  }

  #wrapOutbound(value: unknown): unknown {
    return instanceOfTransferable(value) ? this.wrapForOwner(value) : value;
  }

  #wrapInbound(value: unknown): unknown {
    return instanceOfTransferable(value) ? this.wrapForConsumer(value) : value;
  }
}

export const transferableMarshalerInstance = new TransferableMarshaler();
