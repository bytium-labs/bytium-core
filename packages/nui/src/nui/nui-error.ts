/**
 * The error thrown by {@link nui.call} when a `@NUICallback` handler rejects. Rebuilt from the server's
 * serialized `__bytiumError`, so its `code` and per-field `errors` survive the trip back to the NUI.
 */
export class NuiError extends Error {
  constructor(
    message: string,
    public readonly code?: string | number,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);

    this.name = "NuiError";
  }

  /** Rebuilds a {@link NuiError} from a serialized `__bytiumError` payload. */
  static from(data: unknown): NuiError {
    const source = (data ?? {}) as {
      __isErrorInstance?: boolean;
      name?: string;
      message?: string;
      code?: string | number;
      errors?: Record<string, string[]>;
      value?: unknown;
    };

    if (source.__isErrorInstance === false) {
      return new NuiError(typeof source.value === "string" ? source.value : "NUI call failed");
    }

    const error = new NuiError(source.message ?? "NUI call failed", source.code, source.errors);

    if (source.name) error.name = source.name;

    return error;
  }
}
