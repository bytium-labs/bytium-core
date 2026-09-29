import { HttpException } from "@http/exceptions/http.exception";

/** Thrown to respond with HTTP 404 Not Found. */
export class NotFoundException extends HttpException {
  constructor(message = "Not Found") {
    super(404, message);

    this.name = "NotFoundException";
  }
}
