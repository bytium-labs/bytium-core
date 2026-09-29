/**
 * Implement to run cleanup during resource stop, after every {@link OnModuleDestroyInterface.onModuleDestroy} and before {@link OnResourceShutdownInterface.onResourceShutdown}, in reverse dependency order.
 */
export interface BeforeResourceShutdownInterface {
  beforeResourceShutdown(): Promise<void> | void;
}

export function instanceOfBeforeResourceShutdown(value: unknown): value is BeforeResourceShutdownInterface {
  return (
    typeof value === "object" &&
    value !== null &&
    "beforeResourceShutdown" in value &&
    typeof value.beforeResourceShutdown === "function"
  );
}
