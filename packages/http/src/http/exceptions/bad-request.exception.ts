import { HttpException } from "@http/exceptions/http.exception";

/** Thrown to respond with HTTP 400 Bad Request. */
export class BadRequestException extends HttpException {
  constructor(message = "Bad Request") {
    super(400, message);

    this.name = "BadRequestException";
  }
}
