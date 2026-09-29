/**
 * Thrown when a token is registered with a mix of multi and non-multi providers.
 */
export class MixedMultiProviderException extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "MixedMultiProviderException";
  }
}
