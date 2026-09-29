/**
 * Thrown when a command name or alias is already registered.
 */
export class CommandAlreadyRegisteredException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "CommandAlreadyRegisteredException";
  }
}
