/**
 * Thrown when a value placed in a module option array is of the wrong kind (e.g. a provider in `imports`, or a module in `providers`).
 */
export class WrongDependencyTypeException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "WrongDependencyTypeException";
  }
}
