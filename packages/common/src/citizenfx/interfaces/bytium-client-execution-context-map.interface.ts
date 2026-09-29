import { KeyBindStateEnum } from "@citizenfx/enums/key-bind-state.enum";

/**
 * Client-only invocation surfaces, open for module augmentation by client-side custom triggers.
 */
export interface BytiumClientExecutionContextMap {
  NET_CALLBACK: { args: unknown[] };
  ON_NET_EVENT: { args: unknown[] };
  ON_GAME_EVENT: { args: unknown[] };
  KEY_BIND: { state: KeyBindStateEnum };
  NUI_CALLBACK: { data: unknown };
  ON_CLIENT_RESOURCE_START: Record<string, never>;
  ON_CLIENT_RESOURCE_STOP: Record<string, never>;
}
