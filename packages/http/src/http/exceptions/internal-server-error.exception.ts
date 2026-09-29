import { HttpException } from "@http/exceptions/http.exception";

/** Thrown to respond with HTTP 500 Internal Server Error. */
export class InternalServerErrorException extends HttpException {
  constructor(message = "Internal Server Error") {
    super(500, message);

    this.name = "InternalServerErrorException";
  }
}
