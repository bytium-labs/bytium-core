import { I18nModuleOptionsInterface } from "@i18n/interfaces/i18n-module-options.interface";

/**
 * Async options for `I18nModule.forRootAsync`, producing {@link I18nModuleOptionsInterface} from a factory
 * so the options can depend on other providers (e.g. reading the default locale from a config service).
 */
export interface I18nModuleAsyncOptions {
  /** Factory returning the module options; may be async and may depend on injected providers. */
  useFactory: (...args: any[]) => I18nModuleOptionsInterface | Promise<I18nModuleOptionsInterface>;

  /** Providers injected into `useFactory`, in order. */
  inject?: any[];

  /** When `true`, `I18nService` is available to every module without explicit imports. */
  global?: boolean;
}
