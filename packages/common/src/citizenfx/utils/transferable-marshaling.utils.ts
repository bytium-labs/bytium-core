import { deserializeError, isSerializedError, serializeError } from "@citizenfx/utils/error-serialization.utils";
import { appendCorrelationEnvelope, extractCorrelationEnvelope } from "@citizenfx/utils/correlation-envelope.utils";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";

export function isTransferable(value: unknown): value is object {
  return value !== null && typeof value === "object" && "__ownerResourceName" in value;
}

function wrapOutbound(value: unknown): unknown {
  return isTransferable(value) ? wrapTransferableForOwner(value) : value;
}

function wrapInbound(value: unknown): unknown {
  return isTransferable(value) ? wrapTransferableForConsumer(value) : value;
}

export function wrapTransferableForOwner<T extends object>(instance: T): T {
  // stable per-property wrappers, so proxy.method === proxy.method holds for identity-based consumers
  const wrappers = new Map<string | symbol, (...args: unknown[]) => unknown>();

  return new Proxy(instance, {
    get(target, property) {
      // no receiver: an accessor must run with `this` = the real instance, or #private brand checks fail
      const value = Reflect.get(target, property);

      if (typeof value !== "function") {
        return value;
      }

      let wrapper = wrappers.get(property);

      if (!wrapper) {
        wrapper = (...rawArgs: unknown[]) => {
          const { args, correlationId } = extractCorrelationEnvelope(rawArgs);
          const inboundArgs = args.map(wrapInbound);
          const method = Reflect.get(target, property) as (...a: unknown[]) => unknown;

          return invocationContextManagerInstance.run(
            () => ({
              correlationId: correlationId ?? crypto.randomUUID(),
              type: "TRANSFERABLE",
              handler: `${target.constructor.name}.${String(property)}`,
              invokedBy: GetInvokingResource(),
            }),
            () => {
              try {
                const result = method.apply(target, inboundArgs);

                if (result instanceof Promise) {
                  return result.then(wrapOutbound, (error) => serializeError(error));
                }

                return wrapOutbound(result);
              } catch (error) {
                return serializeError(error);
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

export function wrapTransferableForConsumer<T extends object>(instance: T): T {
  // stable per-property wrappers, so proxy.method === proxy.method holds for identity-based consumers
  const wrappers = new Map<string | symbol, (...args: unknown[]) => unknown>();

  return new Proxy(instance, {
    get(target, property) {
      // no receiver: an accessor must run with `this` = the real instance, or #private brand checks fail
      const value = Reflect.get(target, property);

      if (typeof value !== "function") {
        return value;
      }

      let wrapper = wrappers.get(property);

      if (!wrapper) {
        wrapper = (...args: unknown[]) => {
          const outboundArgs = appendCorrelationEnvelope(args.map(wrapOutbound));
          const method = Reflect.get(target, property) as (...a: unknown[]) => unknown;
          const result = method.apply(target, outboundArgs);

          if (isSerializedError(result)) {
            throw deserializeError(result);
          }

          if (result instanceof Promise) {
            return result.then((resolved) => {
              if (isSerializedError(resolved)) {
                throw deserializeError(resolved);
              }

              return wrapInbound(resolved);
            });
          }

          return wrapInbound(result);
        };
        wrappers.set(property, wrapper);
      }

      return wrapper;
    },
  });
}
