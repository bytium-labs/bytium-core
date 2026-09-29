/**
 * Invocation surfaces present on both server and client, open for module augmentation by custom triggers that run in both environments.
 */
export interface BytiumSharedExecutionContextMap {
  COMMAND: { source: number; args: string[]; rawCommand: string };
  CALLBACK: { args: unknown[] };
  ON_EVENT: { args: unknown[] };
  ON_CONVAR_CHANGE: { convarName: string };
  ON_RESOURCE_START: Record<string, never>;
  ON_RESOURCE_STOP: Record<string, never>;
  TICK: Record<string, never>;
  CRON: Record<string, never>;
}
