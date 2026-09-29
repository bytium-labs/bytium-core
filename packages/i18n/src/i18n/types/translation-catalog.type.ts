import { PluralCategory } from "@i18n/types/plural-category.type";

/** A leaf translation: a plain string, or plural forms keyed by CLDR plural category. */
export type TranslationValue = string | Partial<Record<PluralCategory, string>>;

/** A nested catalog of translations for a single locale. */
export interface TranslationCatalog {
  [key: string]: TranslationValue | TranslationCatalog;
}
