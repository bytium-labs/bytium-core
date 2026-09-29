/**
 * Options for the i18n module (`I18nModule.forRoot` / `forRootAsync`).
 */
export interface I18nModuleOptionsInterface {
  /** Locale used by `t()` when no explicit locale is passed. */
  defaultLocale: string;

  /** Locales to load; each is read from `<path>/<locale>.json` relative to the resource root. */
  locales: string[];

  /**
   * Directory (relative to the resource root) holding the `<locale>.json` catalog files.
   *
   * @default "locales"
   */
  path?: string;

  /**
   * Locale to fall back to when a key is missing in the requested locale.
   *
   * @default defaultLocale
   */
  fallbackLocale?: string;

  /** When `true`, `I18nService` is available to every module without explicit imports. */
  global?: boolean;
}
