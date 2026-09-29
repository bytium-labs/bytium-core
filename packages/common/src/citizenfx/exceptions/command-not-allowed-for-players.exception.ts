/**
 * Thrown when a command that is not allowed for players is invoked by a player.
 */
export class CommandNotAllowedForPlayersException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "CommandNotAllowedForPlayersException";
  }
}
