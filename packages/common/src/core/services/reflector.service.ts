import { Injectable } from "@core/decorators/injectable.decorator";

/**
 * Injectable wrapper around `Reflect.getMetadata` with composite read helpers.
 */
@Injectable()
export class Reflector {
  /** Reads a single metadata value from `target` (or from `target[propertyKey]` when a property key is given). */
  get<T = unknown>(metadataKey: unknown, target: object, propertyKey?: string | symbol): T | undefined {
    if (propertyKey !== undefined) {
      return Reflect.getMetadata(metadataKey, target, propertyKey);
    }

    return Reflect.getMetadata(metadataKey, target);
  }

  /** Reads the metadata value from each target, returning one entry per target in the same order. */
  getAll<T = unknown>(metadataKey: unknown, targets: object[]): (T | undefined)[] {
    return targets.map((target) => Reflect.getMetadata(metadataKey, target));
  }

  /** Reads the metadata from every target and merges the defined values - arrays are concatenated, plain objects are shallow-merged. */
  getAllAndMerge<T = unknown>(metadataKey: unknown, targets: object[]): T {
    const definedValues = this.getAll<unknown>(metadataKey, targets).filter((value) => value !== undefined);

    if (definedValues.length === 0) return [] as unknown as T;

    return definedValues.reduce((accumulator, current) => {
      if (Array.isArray(accumulator)) {
        return [...accumulator, ...(Array.isArray(current) ? current : [current])];
      }

      if (this.#isPlainObject(accumulator) && this.#isPlainObject(current)) {
        return { ...accumulator, ...current };
      }

      return [accumulator, current];
    }) as T;
  }

  /** Returns the first defined metadata value found while scanning targets in order - later targets are ignored once one is found. */
  getAllAndOverride<T = unknown>(metadataKey: unknown, targets: object[]): T | undefined {
    for (const target of targets) {
      const value = Reflect.getMetadata(metadataKey, target);

      if (value !== undefined) return value as T;
    }

    return undefined;
  }

  #isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) return false;

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  }
}
