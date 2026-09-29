/**
 * Server-only invocation surfaces, open for module augmentation by server-side custom triggers.
 */
export interface BytiumServerExecutionContextMap {
  NET_CALLBACK: { source: number; args: unknown[] };
  ON_NET_EVENT: { source: number; args: unknown[] };
  ON_CONSOLE_OUTPUT: { channel: string; message: string };
  ON_SERVER_RESOURCE_START: Record<string, never>;
  ON_SERVER_RESOURCE_STOP: Record<string, never>;
}
