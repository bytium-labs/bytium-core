export function globalConvarKey(convar: string): string {
  return `global:${convar}`;
}

export function resourceConvarKey(convar: string): string {
  return `${GetCurrentResourceName()}:${convar}`;
}

/**
 * Reads a framework convar, preferring the resource-scoped value over the global one.
 */
export function resolveConvarValue(convar: string): string {
  const resourceValue = GetConvar(resourceConvarKey(convar), "").trim();
  const globalValue = GetConvar(globalConvarKey(convar), "").trim();

  return resourceValue || globalValue;
}
