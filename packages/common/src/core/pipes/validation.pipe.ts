import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { StandardSchemaV1 } from "@core/interfaces/standard-schema.interface";
import { ValidationException } from "@core/exceptions/validation.exception";

/**
 * Validates a handler argument against a Standard Schema (Zod, Valibot, ArkType, ...). On success the parsed
 * (and coerced) value is returned; on failure a {@link ValidationException} carrying per-field errors is thrown.
 */
export class ValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: StandardSchemaV1<unknown, T>) {}

  async transform(value: unknown): Promise<T> {
    const result = await this.schema["~standard"].validate(value);

    if (result.issues) {
      throw new ValidationException(this.#toErrors(result.issues));
    }

    return (result as StandardSchemaV1.SuccessResult<T>).value;
  }

  #toErrors(issues: ReadonlyArray<StandardSchemaV1.Issue>): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    for (const issue of issues) {
      const field =
        (issue.path ?? []).map((segment) => String(typeof segment === "object" ? segment.key : segment)).join(".") ||
        "_";

      if (!errors[field]) errors[field] = [];

      errors[field].push(issue.message);
    }

    return errors;
  }
}
