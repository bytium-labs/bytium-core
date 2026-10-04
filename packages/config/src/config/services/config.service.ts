import { Inject, Injectable } from "@bytium-core/common";
import { ConfigModuleOptionsInterface } from "@config/interfaces/config-module-options.interface";

/**
 * Reads the resource configuration merged from the config file, loaders, and convars.
 */
@Injectable()
export class ConfigService {
  private readonly config: Record<string, any>;

  constructor(@Inject("CONFIG_OPTIONS") options: ConfigModuleOptionsInterface) {
    const fromFile = options.ignoreEnvFile ? {} : this.loadFile(options.configFilePath ?? "config.json");
    const merged: Record<string, any> = { ...fromFile };

    for (const loader of options.load ?? []) {
      Object.assign(merged, loader());
    }

    let result: Record<string, any> = merged;

    if (options.expandVariables) {
      result = this.expandVariables(result);
    }

    if (options.validationSchema) {
      const { value, error } = options.validationSchema.validate(result);

      if (error) {
        throw error instanceof Error ? error : new Error(`Config validation failed: ${String(error)}`);
      }

      if (value !== undefined) result = value;
    }

    if (options.validate) {
      result = options.validate(result);
    }

    this.config = result;
  }

  /** Reads a config value by dot-notation key, returning `defaultValue` when it is absent. */
  get<T = any>(key: string): T | undefined;
  get<T = any>(key: string, defaultValue: T): T;
  get<T = any>(key: string, defaultValue?: T): T | undefined {
    const value = this.resolve(key);

    return value !== undefined ? (value as T) : defaultValue;
  }

  /** Reads a config value by dot-notation key, throwing when it is absent. */
  getOrThrow<T = any>(key: string): T {
    const value = this.resolve(key);

    if (value === undefined) {
      throw new Error(`Config key "${key}" is not defined.`);
    }

    return value as T;
  }

  /** Reads a convar as a string, returning `defaultValue` when it is unset. */
  getConvar(key: string, defaultValue = ""): string {
    return GetConvar(key, defaultValue);
  }

  /** Reads a convar as an integer, returning `defaultValue` when it is unset. */
  getConvarInt(key: string, defaultValue = 0): number {
    return GetConvarInt(key, defaultValue);
  }

  /** Reads a convar as a float, returning `defaultValue` when it is unset. */
  getConvarFloat(key: string, defaultValue = 0): number {
    return parseFloat(GetConvar(key, String(defaultValue)));
  }

  /** Reads a convar as a boolean (`true`/`1` or `false`/`0`), returning `defaultValue` otherwise. */
  getConvarBool(key: string, defaultValue = false): boolean {
    const value = GetConvar(key, String(defaultValue)).toLowerCase().trim();

    if (value === "true" || value === "1") return true;

    if (value === "false" || value === "0") return false;

    return defaultValue;
  }

  private loadFile(path: string): Record<string, any> {
    const raw = LoadResourceFile(GetCurrentResourceName(), path);

    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private resolve(key: string): any {
    return key.split(".").reduce((obj, part) => {
      return obj !== null && obj !== undefined ? obj[part] : undefined;
    }, this.config as any);
  }

  private expandVariables(input: Record<string, any>): Record<string, any> {
    const lookup = (key: string): unknown => {
      return key.split(".").reduce((obj: any, part: string) => {
        return obj !== null && obj !== undefined ? obj[part] : undefined;
      }, input);
    };
    const interpolate = (value: unknown): unknown => {
      if (typeof value === "string") {
        return value.replace(/\$\{([^}]+)\}/g, (match, key: string) => {
          const resolved = lookup(key.trim());

          return resolved === undefined ? match : String(resolved);
        });
      }

      if (Array.isArray(value)) return value.map(interpolate);

      if (value !== null && typeof value === "object") {
        const result: Record<string, any> = {};

        for (const [k, v] of Object.entries(value)) {
          result[k] = interpolate(v);
        }

        return result;
      }

      return value;
    };

    return interpolate(input) as Record<string, any>;
  }
}
