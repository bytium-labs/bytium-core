import { NuiError } from "@bytium-core/nui";

/**
 * The state tracked by {@link useNuiCall} across a call's lifecycle.
 */
export interface NuiCallState<T> {
  /** Whether a call is currently in flight. */
  loading: boolean;

  /** The error the last call rejected with, if any. */
  error?: NuiError;

  /** The value the last call resolved with, if any. */
  data?: T;
}
