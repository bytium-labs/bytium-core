import { BytiumException } from "@core/exceptions/bytium.exception";

/**
 * Thrown when input fails validation. Carries per-field messages in `errors` and HTTP status 400.
 */
export class ValidationException extends BytiumException {
  constructor(errors: Record<string, string[]>, message = "Validation failed") {
    super(message, 400, errors);

    this.name = "ValidationException";
  }
}
