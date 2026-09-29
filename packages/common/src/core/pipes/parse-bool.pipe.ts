import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { InvalidArgumentException } from "@core/exceptions/invalid-argument.exception";

/** Coerces `"true"`/`"false"`/`true`/`false` to a boolean; throws `InvalidArgumentException` otherwise. */
export class ParseBoolPipe implements PipeTransform<unknown, boolean> {
  transform(value: unknown): boolean {
    if (value === true || value === "true") return true;

    if (value === false || value === "false") return false;

    throw new InvalidArgumentException(`Expected a boolean but received "${String(value)}".`);
  }
}
