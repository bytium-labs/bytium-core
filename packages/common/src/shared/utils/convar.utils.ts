import { BytiumConvarEnum } from "@shared/enums/bytium-convar.enum";

export function globalConvarKey(convar: BytiumConvarEnum): string {
  return `global:${convar}`;
}

export function resourceConvarKey(convar: BytiumConvarEnum): string {
  return `${GetCurrentResourceName()}:${convar}`;
}

/**
 * Reads a framework convar, preferring the resource-scoped value over the global one.
 */
export function resolveConvarValue(convar: BytiumConvarEnum): string {
  const resourceValue = GetConvar(resourceConvarKey(convar), "").trim();
  const globalValue = GetConvar(globalConvarKey(convar), "").trim();

  return resourceValue || globalValue;
}
