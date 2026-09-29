import { useEffect, useRef } from "react";
import { nui } from "@bytium-core/nui";

/** Subscribes a component to `SendNUIMessage({ action })` pushes, cleaning up on unmount. */
export function useNuiEvent<T = Record<string, unknown>>(action: string, handler: (message: T) => void): void {
  const saved = useRef(handler);

  saved.current = handler;

  useEffect(() => nui.on(action, (message) => saved.current(message as T)), [action]);
}
