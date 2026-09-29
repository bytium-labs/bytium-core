import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { InvalidArgumentException } from "@core/exceptions/invalid-argument.exception";

/** Coerces a value to a number; throws `InvalidArgumentException` if it is not numeric. */
export class ParseFloatPipe implements PipeTransform<unknown, number> {
  transform(value: unknown): number {
    const parsed = typeof value === "number" ? value : Number(value);

    if (Number.isNaN(parsed)) {
      throw new InvalidArgumentException(`Expected a number but received "${String(value)}".`);
    }

    return parsed;
  }
}
