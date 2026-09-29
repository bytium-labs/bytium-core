/**
 * Thrown when a `useFactory` provider in a `forwardRef` cycle returns a primitive instead of an object.
 */
export class CircularFactoryPrimitiveException extends Error {
  constructor(message: string) {
    super(message);

    this.name = "CircularFactoryPrimitiveException";
  }
}
