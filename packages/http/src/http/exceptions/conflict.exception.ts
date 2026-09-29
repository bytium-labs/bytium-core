import { HttpException } from "@http/exceptions/http.exception";

/** Thrown to respond with HTTP 409 Conflict. */
export class ConflictException extends HttpException {
  constructor(message = "Conflict") {
    super(409, message);

    this.name = "ConflictException";
  }
}
