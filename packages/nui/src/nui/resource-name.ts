/** Returns the resource name the NUI belongs to, injected by FiveM as the global `GetParentResourceName`. */
export function resourceName(): string {
  const resolve = (globalThis as { GetParentResourceName?: () => string }).GetParentResourceName;

  return typeof resolve === "function" ? resolve() : "";
}
