import { PipeTransform } from "@core/interfaces/pipe-transform.interface";

/** Substitutes a fallback when the value is `null` or `undefined`; every other value passes through unchanged. */
export class DefaultValuePipe<T> implements PipeTransform<unknown, unknown> {
  constructor(private readonly defaultValue: T) {}

  transform(value: unknown): unknown {
    return value === undefined || value === null ? this.defaultValue : value;
  }
}
