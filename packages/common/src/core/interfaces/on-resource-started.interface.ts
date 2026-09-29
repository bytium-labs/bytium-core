/**
 * Implement to run logic after the FiveM resource has started (following the resource-start event), in dependency-first order. Use for work that requires the resource to be fully live.
 */
export interface OnResourceStartedInterface {
  onResourceStarted(): Promise<void> | void;
}

export function instanceOfOnResourceStarted(value: unknown): value is OnResourceStartedInterface {
  return (
    typeof value === "object" &&
    value !== null &&
    "onResourceStarted" in value &&
    typeof value.onResourceStarted === "function"
  );
}
