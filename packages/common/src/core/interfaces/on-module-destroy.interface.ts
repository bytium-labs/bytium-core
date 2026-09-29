/**
 * Implement to run cleanup when the resource stops. First of the three shutdown hooks; runs in reverse dependency order (dependents before their dependencies).
 */
export interface OnModuleDestroyInterface {
  onModuleDestroy(): Promise<void> | void;
}

export function instanceOfOnModuleDestroy(value: unknown): value is OnModuleDestroyInterface {
  return (
    typeof value === "object" &&
    value !== null &&
    "onModuleDestroy" in value &&
    typeof value.onModuleDestroy === "function"
  );
}
