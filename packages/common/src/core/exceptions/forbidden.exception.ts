import { BytiumException } from "@core/exceptions/bytium.exception";

/**
 * Thrown when access to a handler is denied (e.g. by a guard such as the ACE permission guard). Carries HTTP status 403.
 */
export class ForbiddenException extends BytiumException {
  constructor(message = "Forbidden") {
    super(message, 403);

    this.name = "ForbiddenException";
  }
}
