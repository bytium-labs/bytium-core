import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { StandardSchemaV1 } from "@core/interfaces/standard-schema.interface";
import { ValidationException } from "@core/exceptions/validation.exception";
import { LOG_MASKED_ERRORS } from "@shared/consts/log-masked-errors.const";
import { SENSITIVE_SCHEMA_PATHS } from "@shared/consts/sensitive-schema-paths.const";
import { maskCoversPath } from "@shared/utils/sensitive-paths.utils";

/**
 * Validates a handler argument against a Standard Schema (Zod, Valibot, ArkType, ...). On success the parsed
 * (and coerced) value is returned; on failure a {@link ValidationException} carrying per-field errors is thrown.
 */
export class ValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: StandardSchemaV1<unknown, T>) {}

  async transform(value: unknown): Promise<T> {
    const result = await this.schema["~standard"].validate(value);

    if (result.issues) {
      throw this.#toException(this.#toErrors(result.issues), value);
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

  // the response keeps full messages (the caller sent the value); the log copy gets the received value scrubbed out
  #toException(errors: Record<string, string[]>, input: unknown): ValidationException {
    const exception = new ValidationException(errors);
    const maskedPaths = (Reflect.get(this.schema, SENSITIVE_SCHEMA_PATHS) as string[] | undefined) ?? [];
    const maskedFields = Object.keys(errors).filter((field) =>
      maskedPaths.some((mask) => maskCoversPath(mask, field.split("."))),
    );

    if (maskedFields.length) {
      const logErrors = { ...errors };

      for (const field of maskedFields) {
        logErrors[field] = errors[field].map((message) => this.#scrubValue(message, input, field));
      }

      Object.defineProperty(exception, LOG_MASKED_ERRORS, { value: logErrors });
    }

    return exception;
  }

  #scrubValue(message: string, input: unknown, field: string): string {
    let cursor: unknown = input;

    for (const segment of field.split(".")) {
      cursor = cursor !== null && typeof cursor === "object" ? Reflect.get(cursor, segment) : undefined;
    }

    if (cursor === undefined) {
      return message;
    }

    const bare = String(cursor);

    // a 1-character value cannot be scrubbed safely (it would corrupt the message), so the whole message goes redacted
    if (bare.length < 2) {
      return "[REDACTED]";
    }

    // only the quoted form is unambiguous, any bare leftover redacts the whole message
    const scrubbed = typeof cursor === "string" ? message.replaceAll(JSON.stringify(cursor), '"[REDACTED]"') : message;

    return scrubbed.includes(bare) ? "[REDACTED]" : scrubbed;
  }
}
