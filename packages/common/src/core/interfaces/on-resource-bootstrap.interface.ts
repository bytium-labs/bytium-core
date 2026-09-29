/**
 * Implement to run logic after the whole resource graph is resolved but before the FiveM resource-start event, in dependency-first order. Use for setup that needs every provider constructed.
 */
export interface OnResourceBootstrapInterface {
  onResourceBootstrap(): Promise<void> | void;
}

export function instanceOfOnResourceBootstrap(value: unknown): value is OnResourceBootstrapInterface {
  return (
    typeof value === "object" &&
    value !== null &&
    "onResourceBootstrap" in value &&
    typeof value.onResourceBootstrap === "function"
  );
}
