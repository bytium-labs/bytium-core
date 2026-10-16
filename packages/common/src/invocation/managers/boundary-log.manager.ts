import { BytiumConvarEnum } from "@shared/enums/bytium-convar.enum";
import { globalConvarKey, resourceConvarKey, resolveConvarValue } from "@shared/utils/convar.utils";

export class BoundaryLogManager {
  #excludedTypes: Set<string>;

  constructor() {
    this.#excludedTypes = this.#resolve();

    AddConvarChangeListener(globalConvarKey(BytiumConvarEnum.LOG_BOUNDARY_EXCLUDE), () => {
      this.#excludedTypes = this.#resolve();
    });
    AddConvarChangeListener(resourceConvarKey(BytiumConvarEnum.LOG_BOUNDARY_EXCLUDE), () => {
      this.#excludedTypes = this.#resolve();
    });
  }

  shouldLog(type: string): boolean {
    return !this.#excludedTypes.has(type);
  }

  #resolve(): Set<string> {
    try {
      return new Set(
        resolveConvarValue(BytiumConvarEnum.LOG_BOUNDARY_EXCLUDE)
          .split(",")
          .map((type) => type.trim().toUpperCase())
          .filter(Boolean),
      );
    } catch {
      return new Set();
    }
  }
}

export const boundaryLogManagerInstance = new BoundaryLogManager();
