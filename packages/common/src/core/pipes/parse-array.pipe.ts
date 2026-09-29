import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { ParseArrayOptions } from "@core/interfaces/parse-array-options.interface";
import { InvalidArgumentException } from "@core/exceptions/invalid-argument.exception";

/** Splits a delimited string into an array (arrays pass through); throws `InvalidArgumentException` otherwise. */
export class ParseArrayPipe implements PipeTransform<unknown, unknown[]> {
  constructor(private readonly options: ParseArrayOptions = {}) {}

  transform(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;

    if (typeof value === "string") return value.split(this.options.separator ?? ",");

    throw new InvalidArgumentException(`Expected an array but received "${String(value)}".`);
  }
}
