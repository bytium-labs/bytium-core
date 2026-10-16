import { HandlerArgsLogModeEnum } from "@invocation/enums/handler-args-log-mode.enum";
import { BytiumConvarEnum } from "@shared/enums/bytium-convar.enum";
import { globalConvarKey, resourceConvarKey, resolveConvarValue } from "@shared/utils/convar.utils";

export class HandlerArgsLogManager {
  #mode: HandlerArgsLogModeEnum;

  constructor() {
    this.#mode = this.#resolve();

    AddConvarChangeListener(globalConvarKey(BytiumConvarEnum.LOG_HANDLER_ARGS), () => {
      this.#mode = this.#resolve();
    });
    AddConvarChangeListener(resourceConvarKey(BytiumConvarEnum.LOG_HANDLER_ARGS), () => {
      this.#mode = this.#resolve();
    });
  }

  getMode(): HandlerArgsLogModeEnum {
    return this.#mode;
  }

  #resolve(): HandlerArgsLogModeEnum {
    try {
      const convarValue = resolveConvarValue(BytiumConvarEnum.LOG_HANDLER_ARGS).toUpperCase();

      if (convarValue === HandlerArgsLogModeEnum.ERRORS || convarValue === HandlerArgsLogModeEnum.ALL) {
        return convarValue;
      }

      return HandlerArgsLogModeEnum.OFF;
    } catch {
      return HandlerArgsLogModeEnum.OFF;
    }
  }
}

export const handlerArgsLogManagerInstance = new HandlerArgsLogManager();
