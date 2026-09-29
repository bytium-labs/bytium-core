import { HttpException } from "@http/exceptions/http.exception";

/** Thrown to respond with HTTP 429 Too Many Requests. */
export class TooManyRequestsException extends HttpException {
  constructor(message = "Too Many Requests") {
    super(429, message);

    this.name = "TooManyRequestsException";
  }
}
