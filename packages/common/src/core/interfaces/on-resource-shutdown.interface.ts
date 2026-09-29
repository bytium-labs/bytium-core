/**
 * Implement to run the final cleanup during resource stop, after onModuleDestroy and beforeResourceShutdown, in reverse dependency order.
 */
export interface OnResourceShutdownInterface {
  onResourceShutdown(): Promise<void> | void;
}

export function instanceOfOnResourceShutdown(value: unknown): value is OnResourceShutdownInterface {
  return (
    typeof value === "object" &&
    value !== null &&
    "onResourceShutdown" in value &&
    typeof value.onResourceShutdown === "function"
  );
}
