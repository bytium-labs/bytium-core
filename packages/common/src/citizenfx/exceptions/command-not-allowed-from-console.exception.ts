/**
 * Thrown when a command that cannot be used by the server is invoked from the console.
 */
export class CommandNotAllowedFromConsoleException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "CommandNotAllowedFromConsoleException";
  }
}
