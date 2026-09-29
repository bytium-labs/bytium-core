/**
 * Thrown when a cron job with the same identifier is already registered.
 */
export class CronJobAlreadyRegisteredException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "CronJobAlreadyRegisteredException";
  }
}
