import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { InvalidArgumentException } from "@core/exceptions/invalid-argument.exception";

/** Validates that the value is a member of the given enum; throws `InvalidArgumentException` otherwise. */
export class ParseEnumPipe<TEnum extends object> implements PipeTransform<unknown, TEnum[keyof TEnum]> {
  constructor(private readonly enumType: TEnum) {}

  transform(value: unknown): TEnum[keyof TEnum] {
    const members = Object.values(this.enumType);

    if (members.includes(value)) return value as TEnum[keyof TEnum];

    throw new InvalidArgumentException(`Expected one of [${members.join(", ")}] but received "${String(value)}".`);
  }
}
