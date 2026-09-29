/**
 * Thrown when a module exports a token it neither provides nor imports.
 */
export class ExportedDependencyNotProvidedException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "ExportedDependencyNotProvidedException";
  }
}
