import { LogFormatEnum } from "@logger/enums/log-format.enum";
import { BytiumConvarEnum } from "@shared/enums/bytium-convar.enum";
import { globalConvarKey, resourceConvarKey, resolveConvarValue } from "@shared/utils/convar.utils";

export class LoggerFormatManager {
  #format: LogFormatEnum;

  constructor() {
    this.#format = this.#resolve();

    AddConvarChangeListener(globalConvarKey(BytiumConvarEnum.LOG_FORMAT), () => {
      this.#format = this.#resolve();
    });
    AddConvarChangeListener(resourceConvarKey(BytiumConvarEnum.LOG_FORMAT), () => {
      this.#format = this.#resolve();
    });
  }

  getFormat(): LogFormatEnum {
    return this.#format;
  }

  #resolve(): LogFormatEnum {
    try {
      const convarValue = resolveConvarValue(BytiumConvarEnum.LOG_FORMAT).toUpperCase();

      return convarValue === LogFormatEnum.JSON ? LogFormatEnum.JSON : LogFormatEnum.PRETTY;
    } catch {
      return LogFormatEnum.PRETTY;
    }
  }
}

export const loggerFormatManagerInstance = new LoggerFormatManager();
