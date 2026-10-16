import { MAX_SERIALIZED_HANDLER_ARG_LENGTH } from "@invocation/consts/max-serialized-handler-arg-length.const";
import { SensitiveMaskType } from "@invocation/types/sensitive-mask.type";
import { maskValueAtPaths } from "@shared/utils/sensitive-paths.utils";

export class HandlerArgsSerializer {
  static serialize(args: unknown[], masks: ReadonlyMap<number, SensitiveMaskType>): unknown[] {
    return args.map((arg, index) => {
      const mask = masks.get(index);

      return mask === true ? "[REDACTED]" : this.#serializeArg(arg, mask);
    });
  }

  static #serializeArg(arg: unknown, maskedPaths: readonly string[] | undefined): unknown {
    if (arg instanceof Error) {
      return { name: arg.name, message: arg.message };
    }

    try {
      const json = JSON.stringify(arg, this.#classInstancePlaceholderReplacer);

      if (json === undefined) {
        return this.#truncate(String(arg));
      }

      // snapshot (not a live ref); mask BEFORE the cap or a truncated string leaks masked values
      const snapshot = JSON.parse(json) as unknown;

      if (maskedPaths?.length) {
        maskValueAtPaths(snapshot, maskedPaths);
      }

      const serialized = maskedPaths?.length ? JSON.stringify(snapshot) : json;

      return serialized.length > MAX_SERIALIZED_HANDLER_ARG_LENGTH ? this.#truncate(serialized) : snapshot;
    } catch {
      return this.#truncate(String(arg));
    }
  }

  // replacer sees post-toJSON values; class instances are handles, not data
  static #classInstancePlaceholderReplacer(_key: string, value: unknown): unknown {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }

    const prototype = Object.getPrototypeOf(value) as object | null;

    if (prototype === Object.prototype || prototype === null) {
      return value;
    }

    return `[${value.constructor?.name ?? "Object"}]`;
  }

  static #truncate(value: string): string {
    return value.length > MAX_SERIALIZED_HANDLER_ARG_LENGTH
      ? `${value.slice(0, MAX_SERIALIZED_HANDLER_ARG_LENGTH)}...[truncated]`
      : value;
  }
}
