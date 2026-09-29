import { Inject, Injectable } from "@bytium-core/common";
import { I18nModuleOptionsInterface } from "@i18n/interfaces/i18n-module-options.interface";
import { PluralCategory } from "@i18n/types/plural-category.type";
import { TranslationCatalog, TranslationValue } from "@i18n/types/translation-catalog.type";
import { TranslationParams } from "@i18n/types/translation-params.type";

/**
 * Resolves configurable, translatable messages from per-locale catalog files.
 */
@Injectable()
export class I18nService {
  readonly #catalogs = new Map<string, TranslationCatalog>();
  readonly #defaultLocale: string;
  readonly #fallbackLocale: string;

  constructor(@Inject("I18N_OPTIONS") options: I18nModuleOptionsInterface) {
    this.#defaultLocale = options.defaultLocale;
    this.#fallbackLocale = options.fallbackLocale ?? options.defaultLocale;

    const path = options.path ?? "locales";

    for (const locale of options.locales) {
      this.#catalogs.set(locale, this.#loadCatalog(`${path}/${locale}.json`));
    }
  }

  /**
   * Translates a dot-notation `key` for `locale` (defaults to the configured default locale), replacing
   * `{placeholder}` tokens from `params`. Passing a `count` param selects the matching plural form. When
   * the key is missing it falls back to the fallback locale, then returns `key` itself.
   */
  t(key: string, params: TranslationParams = {}, locale: string = this.#defaultLocale): string {
    const value = this.#lookup(key, locale) ?? this.#lookup(key, this.#fallbackLocale);

    if (value === undefined) {
      return key;
    }

    return this.#interpolate(this.#selectPluralForm(value, params.count, locale), params);
  }

  /** The default locale configured for this resource. */
  getDefaultLocale(): string {
    return this.#defaultLocale;
  }

  /** Whether a catalog is loaded for `locale`. */
  hasLocale(locale: string): boolean {
    return this.#catalogs.has(locale);
  }

  #loadCatalog(path: string): TranslationCatalog {
    const raw = LoadResourceFile(GetCurrentResourceName(), path);

    try {
      return JSON.parse(raw) as TranslationCatalog;
    } catch {
      return {};
    }
  }

  #lookup(key: string, locale: string): TranslationValue | undefined {
    const catalog = this.#catalogs.get(locale);

    if (!catalog) {
      return undefined;
    }

    let node: unknown = catalog;

    for (const part of key.split(".")) {
      if (node === null || typeof node !== "object") {
        return undefined;
      }

      node = (node as Record<string, unknown>)[part];
    }

    if (typeof node === "string") {
      return node;
    }

    if (node !== null && typeof node === "object" && !Array.isArray(node)) {
      return node as Partial<Record<PluralCategory, string>>;
    }

    return undefined;
  }

  #selectPluralForm(value: TranslationValue, count: string | number | undefined, locale: string): string {
    if (typeof value === "string") {
      return value;
    }

    if (count === undefined) {
      return value.other ?? "";
    }

    const category = new Intl.PluralRules(locale).select(Number(count)) as PluralCategory;

    return value[category] ?? value.other ?? "";
  }

  #interpolate(template: string, params: TranslationParams): string {
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name];

      return value === undefined ? match : String(value);
    });
  }
}
