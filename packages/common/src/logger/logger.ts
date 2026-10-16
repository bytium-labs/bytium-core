import { LogFormatEnum } from "@logger/enums/log-format.enum";
import { LogLevelEnum } from "@logger/enums/log-level.enum";
import { loggerFormatManagerInstance } from "@logger/managers/logger-format.manager";
import { loggerLevelsManagerInstance } from "@logger/managers/logger-levels.manager";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";
import { LOG_MASKED_ERRORS } from "@shared/consts/log-masked-errors.const";

/**
 * Framework logger with per-level filtering and a context label shown in every line.
 */
export class Logger {
  static readonly #resourceName = GetCurrentResourceName();

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

    // the FiveM console formatter does not render Error.cause, so surface it explicitly
    const prettyArgs = args.flatMap((arg) => {
      const printable = this.#printableError(arg);

      return printable instanceof Error && printable.cause instanceof Error
        ? [printable, "\nCaused by:", printable.cause]
        : [printable];
    });

    console.log(`${color}[${this.name}] ${message}`, ...prettyArgs, "^7");
  }

  #jsonEntry(level: LogLevelEnum, message: string, args: unknown[]): Record<string, unknown> {
    const invocationContext = invocationContextManagerInstance.getContext();
    const entry: Record<string, unknown> = {
      timestamp: Date.now(),
      level: level.toLowerCase(),
      resource: Logger.#resourceName,
      context: this.name,
      message: String(message).replace(/\^[0-9]/g, ""),
      ...invocationContext,
      ...invocationContext?.__bytiumMetadata,
    };

    delete entry.__bytiumMetadata;
    delete entry.__bytiumHandlerArgs;
    const payload: unknown[] = [];

    for (const arg of args) {
      if (arg instanceof Error) {
        if (entry.error === undefined) {
          entry.error = this.#decomposeError(arg);

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

    if (entry.error !== undefined && invocationContext?.__bytiumHandlerArgs) {
      entry.args = invocationContext.__bytiumHandlerArgs;
    }

    if (payload.length > 0) {
      entry.payload = payload;
    }

    return entry;
  }

  // pretty prints errors verbatim: swap in the scrubbed clone
  #printableError(arg: unknown): unknown {
    if (!(arg instanceof Error)) {
      return arg;
    }

    const maskedErrors = Reflect.get(arg, LOG_MASKED_ERRORS);

    if (maskedErrors === undefined) {
      return arg;
    }

    const printable = Object.assign(Object.create(Object.getPrototypeOf(arg) as object) as Error, arg);

    printable.message = arg.message;
    printable.stack = arg.stack;

    if (arg.cause !== undefined) {
      printable.cause = arg.cause;
    }

    Reflect.set(printable, "errors", maskedErrors);

    return printable;
  }

  #decomposeError(error: Error): Record<string, unknown> {
    const cause = error.cause instanceof Error ? error.cause : undefined;
    const decomposed: Record<string, unknown> = { name: error.name, message: error.message };

    for (const [key, value] of Object.entries(error)) {
      if (key === "name" || key === "message" || key === "stack" || key === "cause") {
        continue;
      }

      try {
        JSON.stringify(value);
        decomposed[key] = value;
      } catch {
        decomposed[key] = String(value);
      }
    }

    const maskedErrors = Reflect.get(error, LOG_MASKED_ERRORS);

    if (maskedErrors !== undefined && decomposed.errors !== undefined) {
      decomposed.errors = maskedErrors;
    }

    if (cause) {
      decomposed.cause = { name: cause.name, message: cause.message };
    }

    decomposed.stack = cause?.stack ? `${error.stack}\nCaused by: ${cause.stack}` : error.stack;

    return decomposed;
  }
}
