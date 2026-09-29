import { HttpException } from "@http/exceptions/http.exception";

/** Thrown to respond with HTTP 401 Unauthorized. */
export class UnauthorizedException extends HttpException {
  constructor(message = "Unauthorized") {
    super(401, message);

    this.name = "UnauthorizedException";
  }
}
