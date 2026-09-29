/**
 * Thrown when a command is registered with an invalid name.
 */
export class CommandNameInvalidException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "CommandNameInvalidException";
  }
}
