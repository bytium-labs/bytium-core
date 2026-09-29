/**
 * Thrown when a tick with the same identifier is already registered.
 */
export class TickAlreadyRegisteredException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "TickAlreadyRegisteredException";
  }
}
