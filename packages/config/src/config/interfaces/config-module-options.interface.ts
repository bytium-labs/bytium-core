import { ConfigValidationSchema } from "@config/interfaces/config-validation-schema.interface";

/**
 * Options for the config module (`ConfigModule.forRoot` / `forRootAsync`).
 */
export interface ConfigModuleOptionsInterface {
  /**
   * Path to the JSON config file relative to the resource root.
   *
   * @default "config.json"
   */
  configFilePath?: string;

  /** When `true`, the JSON config file is not loaded. */
  ignoreEnvFile?: boolean;

  /** Loader functions whose values are merged into the config; later loaders win on conflicts. */
  load?: Array<() => Record<string, any>>;

  /** Validates (and may transform) the merged config; throw to abort startup. */
  validate?: (config: Record<string, any>) => Record<string, any>;

  /** Schema validator run against the merged config (any object with `validate(input) -> { value, error }`). */
  validationSchema?: ConfigValidationSchema;

  /** When `true`, `${VAR}` placeholders in string values are replaced with other config values. */
  expandVariables?: boolean;

  /** When `true`, `ConfigService` is available to every module without explicit imports. */
  global?: boolean;
}
