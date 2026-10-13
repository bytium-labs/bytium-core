import { BytiumException } from "@core/exceptions/bytium.exception";
import { SerializedErrorInterface } from "@citizenfx/interfaces/serialized-error.interface";
import { isDevMode } from "@shared/utils/is-dev-mode.utils";

export function serializeError(error: Error | unknown): SerializedErrorInterface {
  if (isDevMode()) {
    return serializeVerbose(error);
  }

  if (error instanceof BytiumException) {
    return {
      __bytiumError: {
        __isErrorInstance: true,
        __isBytiumException: true,
        name: error.name,
        message: error.message,
        code: error.code,
        ...(error.errors ? { errors: error.errors } : {}),
      },
    };
  }

  return {
    __bytiumError: {
      __isErrorInstance: true,
      __isBytiumException: true,
      name: "InternalError",
      message: "Internal server error",
      code: 500,
    },
  };
}

function serializeVerbose(error: Error | unknown): SerializedErrorInterface {
  if (error instanceof Error) {
    const additionalProps = Object.getOwnPropertyNames(error).reduce<Record<string, unknown>>((acc, key) => {
      if (!["name", "message", "stack", "cause"].includes(key)) {
        acc[key] = Reflect.get(error, key);
      }

      return acc;
    }, {});
    const cause =
      error.cause instanceof Error
        ? { cause: { name: error.cause.name, message: error.cause.message, stack: error.cause.stack } }
        : {};

    return {
      __bytiumError: {
        __isErrorInstance: true,
        ...(error instanceof BytiumException ? { __isBytiumException: true } : {}),
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...cause,
        ...additionalProps,
      },
    };
  }

  return {
    __bytiumError: {
      __isErrorInstance: false,
      value: error,
    },
  };
}

export function deserializeError(serialized: SerializedErrorInterface | unknown): Error | unknown {
  if (!serialized || typeof serialized !== "object" || !("__bytiumError" in serialized)) {
    return serialized;
  }

  const errorData = (serialized as SerializedErrorInterface).__bytiumError;

  if (errorData.__isErrorInstance) {
    const isBytiumException = errorData.__isBytiumException === true;
    const error = isBytiumException
      ? new BytiumException(errorData.message ?? "", errorData.code, errorData.errors)
      : new Error(errorData.message);
    const consumedKeys = isBytiumException
      ? ["__isErrorInstance", "__isBytiumException", "name", "message", "stack", "code", "errors"]
      : ["__isErrorInstance", "__isBytiumException", "name", "message", "stack"];

    error.name = errorData.name ?? error.name;
    error.stack = errorData.stack;

    for (const key of Object.keys(errorData)) {
      if (!consumedKeys.includes(key)) {
        Reflect.set(error, key, Reflect.get(errorData, key));
      }
    }

    return error;
  }

  return errorData.value;
}

export function isSerializedError(value: unknown): value is SerializedErrorInterface {
  return value !== null && typeof value === "object" && !Array.isArray(value) && "__bytiumError" in value;
}
