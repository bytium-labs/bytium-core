/**
 * Thrown when a tick is referenced (e.g. stopped) but is not registered.
 */
export class TickNotFoundException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "TickNotFoundException";
  }
}
