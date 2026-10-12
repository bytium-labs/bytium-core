import { LogFormatEnum } from "@logger/enums/log-format.enum";
import { LogLevelEnum } from "@logger/enums/log-level.enum";
import { loggerFormatManagerInstance } from "@logger/managers/logger-format.manager";
import { loggerLevelsManagerInstance } from "@logger/managers/logger-levels.manager";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";

// invariant for the resource's lifetime; read once instead of a native call per json line
const resourceName = GetCurrentResourceName();

/**
 * Framework logger with per-level filtering and a context label shown in every line.
 */
export class Logger {
  constructor(
    private name: string,
    private readonly levels?: LogLevelEnum[],
  ) {}

  get #activeLevels(): LogLevelEnum[] {
    return this.levels ?? loggerLevelsManagerInstance.getLevels();
  }

  /**
   * Changes the context (name) shown in this logger's output.
   */
  setContext(context: string): void {
    this.name = context;
  }

  /** Logs at `VERBOSE` level. */
  verbose(message: string, ...args: unknown[]) {
    this.#emit(LogLevelEnum.VERBOSE, "^7", message, args);
  }

  /** Logs at `DEBUG` level. */
  debug(message: string, ...args: unknown[]) {
    this.#emit(LogLevelEnum.DEBUG, "^6", message, args);
  }

  /** Logs at `ERROR` level. */
  error(message: string, ...args: unknown[]) {
    this.#emit(LogLevelEnum.ERROR, "^1", message, args);
  }

  /** Logs at `INFO` level. */
  log(message: string, ...args: unknown[]) {
    this.#emit(LogLevelEnum.INFO, "^5", message, args);
  }

  /** Logs at `WARN` level. */
  warn(message: string, ...args: unknown[]) {
    this.#emit(LogLevelEnum.WARN, "^3", message, args);
  }

  /** Logs at `FATAL` level. */
  fatal(message: string, ...args: unknown[]) {
    this.#emit(LogLevelEnum.FATAL, "^1", message, args);
  }

  #emit(level: LogLevelEnum, color: string, message: string, args: unknown[]): void {
    if (!this.#activeLevels.includes(level)) {
      return;
    }

    if (loggerFormatManagerInstance.getFormat() === LogFormatEnum.JSON) {
      console.log(JSON.stringify(this.#jsonEntry(level, message, args)));

      return;
    }

    console.log(`${color}[${this.name}] ${message}`, ...args, "^7");
  }

  #jsonEntry(level: LogLevelEnum, message: string, args: unknown[]): Record<string, unknown> {
    const entry: Record<string, unknown> = {
      timestamp: Date.now(),
      level: level.toLowerCase(),
      resource: resourceName,
      context: this.name,
      message: String(message).replace(/\^[0-9]/g, ""),
      ...invocationContextManagerInstance.getContext(),
    };
    const payload: unknown[] = [];

    for (const arg of args) {
      if (arg instanceof Error) {
        if (entry.error === undefined) {
          entry.error = { name: arg.name, message: arg.message };
          entry.stack = arg.stack;

          continue;
        }

        payload.push({ name: arg.name, message: arg.message, stack: arg.stack });

        continue;
      }

      try {
        JSON.stringify(arg);
        payload.push(arg);
      } catch {
        payload.push(String(arg));
      }
    }

    if (payload.length > 0) {
      entry.payload = payload;
    }

    return entry;
  }
}
