import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { InvalidArgumentException } from "@core/exceptions/invalid-argument.exception";

/** Coerces a value to an integer; throws `InvalidArgumentException` if it is not a whole number. */
export class ParseIntPipe implements PipeTransform<unknown, number> {
  transform(value: unknown): number {
    const parsed = typeof value === "number" ? value : Number(value);

    if (!Number.isInteger(parsed)) {
      throw new InvalidArgumentException(`Expected an integer but received "${String(value)}".`);
    }

    return parsed;
  }
}
