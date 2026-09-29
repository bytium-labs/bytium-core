import { NuiError } from "./nui-error";
import { resourceName } from "./resource-name";

/** Calls a `@NUICallback` handler by name, returning its value or throwing a {@link NuiError} when it rejects. */
async function call<T = unknown>(name: string, data?: unknown): Promise<T> {
  const response = await fetch(`https://${resourceName()}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(data ?? {}),
  });
  const payload = await response.json();

  if (payload && typeof payload === "object" && "__bytiumError" in payload) {
    throw NuiError.from((payload as { __bytiumError: unknown }).__bytiumError);
  }

  return payload as T;
}

/** Subscribes to messages pushed with `SendNUIMessage({ action })`, returning an unsubscribe function. */
function on(action: string, handler: (message: Record<string, unknown>) => void): () => void {
  const listener = (event: MessageEvent): void => {
    const message = event.data as Record<string, unknown>;

    if (message && message.action === action) handler(message);
  };

  window.addEventListener("message", listener);

  return () => window.removeEventListener("message", listener);
}

/** The browser-side entry point for talking to Bytium `@NUICallback` handlers. */
export const nui = { call, on };
