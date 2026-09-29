import { ConfigModuleOptionsInterface } from "@config/interfaces/config-module-options.interface";

/**
 * Async options for the config module, written in `ConfigModule.forRootAsync`.
 */
export interface ConfigModuleAsyncOptions {
  /** Produces the config options; may be async and may depend on injected providers. */
  useFactory: (...args: any[]) => ConfigModuleOptionsInterface | Promise<ConfigModuleOptionsInterface>;

  /** Providers passed to `useFactory`, in declaration order. */
  inject?: any[];

  /** When `true`, `ConfigService` is available to every module without explicit imports. */
  global?: boolean;
}
