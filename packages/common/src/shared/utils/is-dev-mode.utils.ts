import { BytiumConvarEnum } from "@shared/enums/bytium-convar.enum";
import { resolveConvarValue } from "@shared/utils/convar.utils";

/**
 * Whether the resource runs in dev mode (via the `bytium-core:devMode` convar). Off (production) by default.
 */
export function isDevMode(): boolean {
  return resolveConvarValue(BytiumConvarEnum.DevMode).toLowerCase() === "true";
}
