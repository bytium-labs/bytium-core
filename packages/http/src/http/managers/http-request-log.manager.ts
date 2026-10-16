import { HttpConvarEnum } from "@http/enums/http-convar.enum";
import {
  globalConvarKey,
  resourceConvarKey,
  resolveConvarValue,
} from "@bytium-core/common/internal/shared/utils/convar.utils";
import { HttpRequestLogLevelEnum } from "@http/enums/http-request-log-level.enum";

export class HttpRequestLogManager {
  #level: HttpRequestLogLevelEnum;
  #maskedHeaders: string[];
  #maskedKeys: string[];

  constructor() {
    this.#level = this.#resolveLevel();
    this.#maskedHeaders = this.#resolveMaskList(HttpConvarEnum.LOG_HTTP_MASK_HEADERS);
    this.#maskedKeys = this.#resolveMaskList(HttpConvarEnum.LOG_HTTP_MASK_KEYS);

    for (const convar of [
      HttpConvarEnum.LOG_HTTP_REQUESTS,
      HttpConvarEnum.LOG_HTTP_MASK_HEADERS,
      HttpConvarEnum.LOG_HTTP_MASK_KEYS,
    ]) {
      AddConvarChangeListener(globalConvarKey(convar), () => this.#refresh());
      AddConvarChangeListener(resourceConvarKey(convar), () => this.#refresh());
    }
  }

  getLevel(): HttpRequestLogLevelEnum {
    return this.#level;
  }

  getMaskedHeaders(): string[] {
    return this.#maskedHeaders;
  }

  getMaskedKeys(): string[] {
    return this.#maskedKeys;
  }

  #refresh(): void {
    this.#level = this.#resolveLevel();
    this.#maskedHeaders = this.#resolveMaskList(HttpConvarEnum.LOG_HTTP_MASK_HEADERS);
    this.#maskedKeys = this.#resolveMaskList(HttpConvarEnum.LOG_HTTP_MASK_KEYS);
  }

  #resolveLevel(): HttpRequestLogLevelEnum {
    try {
      const convarValue = resolveConvarValue(HttpConvarEnum.LOG_HTTP_REQUESTS).toUpperCase();

      if (convarValue === HttpRequestLogLevelEnum.META || convarValue === HttpRequestLogLevelEnum.FULL) {
        return convarValue;
      }

      return HttpRequestLogLevelEnum.LEAN;
    } catch {
      return HttpRequestLogLevelEnum.LEAN;
    }
  }

  #resolveMaskList(convar: HttpConvarEnum): string[] {
    try {
      return resolveConvarValue(convar)
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter((name) => name.length > 0);
    } catch {
      return [];
    }
  }
}

export const httpRequestLogManagerInstance = new HttpRequestLogManager();
