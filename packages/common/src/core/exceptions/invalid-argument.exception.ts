import { BytiumException } from "@core/exceptions/bytium.exception";

/**
 * Thrown when an argument passed to a framework API is invalid. Carries HTTP status 400, so a pipe rejecting bad
 * input surfaces as a Bad Request rather than a generic server error.
 */
export class InvalidArgumentException extends BytiumException {
  constructor(message = "Invalid argument") {
    super(message, 400);

    this.name = "InvalidArgumentException";
  }
}
