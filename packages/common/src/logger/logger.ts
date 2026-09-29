import { LogLevelEnum } from "@logger/enums/log-level.enum";
import { loggerLevelsManagerInstance } from "@logger/managers/logger-levels.manager";

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
    if (this.#activeLevels.includes(LogLevelEnum.VERBOSE)) {
      console.log(`^7[${this.name}] ${message}`, ...args, "^7");
    }
  }

  /** Logs at `DEBUG` level. */
  debug(message: string, ...args: unknown[]) {
    if (this.#activeLevels.includes(LogLevelEnum.DEBUG)) {
      console.log(`^6[${this.name}] ${message}`, ...args, "^7");
    }
  }

  /** Logs at `ERROR` level. */
  error(message: string, ...args: unknown[]) {
    if (this.#activeLevels.includes(LogLevelEnum.ERROR)) {
      console.log(`^1[${this.name}] ${message}`, ...args, "^7");
    }
  }

  /** Logs at `INFO` level. */
  log(message: string, ...args: unknown[]) {
    if (this.#activeLevels.includes(LogLevelEnum.INFO)) {
      console.log(`^5[${this.name}] ${message}`, ...args, "^7");
    }
  }

  /** Logs at `WARN` level. */
  warn(message: string, ...args: unknown[]) {
    if (this.#activeLevels.includes(LogLevelEnum.WARN)) {
      console.log(`^3[${this.name}] ${message}`, ...args, "^7");
    }
  }

  /** Logs at `FATAL` level. */
  fatal(message: string, ...args: unknown[]) {
    if (this.#activeLevels.includes(LogLevelEnum.FATAL)) {
      console.log(`^1[${this.name}] ${message}`, ...args, "^7");
    }
  }
}
