import { HttpException } from "@http/exceptions/http.exception";

/** Thrown to respond with HTTP 403 Forbidden. */
export class ForbiddenException extends HttpException {
  constructor(message = "Forbidden") {
    super(403, message);

    this.name = "ForbiddenException";
  }
}
