import { LogLevelEnum } from "@logger/enums/log-level.enum";
import { BytiumConvarEnum } from "@shared/enums/bytium-convar.enum";
import { globalConvarKey, resourceConvarKey, resolveConvarValue } from "@shared/utils/convar.utils";

export class LoggerLevelsManager {
  readonly #hierarchy: Record<LogLevelEnum, LogLevelEnum[]> = {
    [LogLevelEnum.VERBOSE]: [
      LogLevelEnum.VERBOSE,
      LogLevelEnum.DEBUG,
      LogLevelEnum.INFO,
      LogLevelEnum.WARN,
      LogLevelEnum.ERROR,
      LogLevelEnum.FATAL,
    ],
    [LogLevelEnum.DEBUG]: [
      LogLevelEnum.DEBUG,
      LogLevelEnum.INFO,
      LogLevelEnum.WARN,
      LogLevelEnum.ERROR,
      LogLevelEnum.FATAL,
    ],
    [LogLevelEnum.INFO]: [LogLevelEnum.INFO, LogLevelEnum.WARN, LogLevelEnum.ERROR, LogLevelEnum.FATAL],
    [LogLevelEnum.WARN]: [LogLevelEnum.WARN, LogLevelEnum.ERROR, LogLevelEnum.FATAL],
    [LogLevelEnum.ERROR]: [LogLevelEnum.ERROR, LogLevelEnum.FATAL],
    [LogLevelEnum.FATAL]: [LogLevelEnum.FATAL],
  };
  #levels: LogLevelEnum[];

  constructor() {
    this.#levels = this.#resolve();

    AddConvarChangeListener(globalConvarKey(BytiumConvarEnum.LogLevel), () => {
      this.#levels = this.#resolve();
    });
    AddConvarChangeListener(resourceConvarKey(BytiumConvarEnum.LogLevel), () => {
      this.#levels = this.#resolve();
    });
  }

  getLevels(): LogLevelEnum[] {
    return this.#levels;
  }

  #resolve(): LogLevelEnum[] {
    try {
      const convarValue = resolveConvarValue(BytiumConvarEnum.LogLevel).toUpperCase();

      return this.#hierarchy[convarValue as LogLevelEnum] ?? this.#hierarchy[LogLevelEnum.INFO];
    } catch {
      return this.#hierarchy[LogLevelEnum.INFO];
    }
  }
}

export const loggerLevelsManagerInstance = new LoggerLevelsManager();
