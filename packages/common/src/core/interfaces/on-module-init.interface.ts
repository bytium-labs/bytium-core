/**
 * Implement to run logic right after this provider or module is constructed, during resolution, in dependency-first order (a dependency's hook runs before its dependents'). The resource is not fully bootstrapped yet at this point.
 */
export interface OnModuleInitInterface {
  onModuleInit(): Promise<void> | void;
}

export function instanceOfOnModuleInit(value: unknown): value is OnModuleInitInterface {
  return (
    typeof value === "object" && value !== null && "onModuleInit" in value && typeof value.onModuleInit === "function"
  );
}
