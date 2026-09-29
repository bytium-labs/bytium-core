import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { InvalidArgumentException } from "@core/exceptions/invalid-argument.exception";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates that the value is a UUID string; throws `InvalidArgumentException` otherwise. */
export class ParseUUIDPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value === "string" && UUID_PATTERN.test(value)) return value;

    throw new InvalidArgumentException(`Expected a UUID but received "${String(value)}".`);
  }
}
