import { useCallback, useState } from "react";
import { nui, NuiError } from "@bytium-core/nui";
import { NuiCallState } from "./interfaces/nui-call-state.interface";

/** Calls a `@NUICallback` handler while tracking `loading`, `error` and `data` for the UI. */
export function useNuiCall<T = unknown>(): NuiCallState<T> & { call: (name: string, data?: unknown) => Promise<T> } {
  const [state, setState] = useState<NuiCallState<T>>({ loading: false });
  const call = useCallback(async (name: string, data?: unknown): Promise<T> => {
    setState({ loading: true });

    try {
      const result = await nui.call<T>(name, data);

      setState({ loading: false, data: result });

      return result;
    } catch (error) {
      setState({ loading: false, error: error as NuiError });

      throw error;
    }
  }, []);

  return { ...state, call };
}
