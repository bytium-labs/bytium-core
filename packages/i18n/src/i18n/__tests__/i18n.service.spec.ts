import { I18nService } from "@i18n/services/i18n.service";
import { I18nModuleOptionsInterface } from "@i18n/interfaces/i18n-module-options.interface";

const catalogFiles: Record<string, string> = {
  "locales/en.json": JSON.stringify({
    greeting: "Hello, {name}!",
    bouncer: { notWhitelisted: "You are not whitelisted." },
    players: { one: "{count} player online", other: "{count} players online" },
  }),
  "locales/pl.json": JSON.stringify({
    greeting: "Czesc, {name}!",
    players: {
      one: "{count} gracz online",
      few: "{count} gracze online",
      many: "{count} graczy online",
      other: "{count} gracza online",
    },
  }),
};
const createI18nService = (options: Partial<I18nModuleOptionsInterface> = {}): I18nService => {
  return new I18nService({ defaultLocale: "en", locales: ["en", "pl"], fallbackLocale: "en", ...options });
};

describe("I18nService", () => {
  beforeEach(() => {
    (global as unknown as { LoadResourceFile: (resource: string, path: string) => string | null }).LoadResourceFile = (
      _resource,
      path,
    ) => catalogFiles[path] ?? null;
    (global as unknown as { GetCurrentResourceName: () => string }).GetCurrentResourceName = () => "test-resource";
  });

  it("translates a key in the default locale and interpolates placeholders", () => {
    const i18nServiceInstance = createI18nService();

    expect(i18nServiceInstance.t("greeting", { name: "Ada" })).toBe("Hello, Ada!");
    expect(i18nServiceInstance.t("bouncer.notWhitelisted")).toBe("You are not whitelisted.");
  });

  it("translates in an explicitly requested locale", () => {
    const i18nServiceInstance = createI18nService();

    expect(i18nServiceInstance.t("greeting", { name: "Ada" }, "pl")).toBe("Czesc, Ada!");
  });

  it("selects a plural form from the count for each locale's rules", () => {
    const i18nServiceInstance = createI18nService();

    expect(i18nServiceInstance.t("players", { count: 1 })).toBe("1 player online");
    expect(i18nServiceInstance.t("players", { count: 5 })).toBe("5 players online");
    expect(i18nServiceInstance.t("players", { count: 2 }, "pl")).toBe("2 gracze online");
    expect(i18nServiceInstance.t("players", { count: 5 }, "pl")).toBe("5 graczy online");
  });

  it("falls back to the fallback locale when a key is missing in the requested locale", () => {
    const i18nServiceInstance = createI18nService();

    expect(i18nServiceInstance.t("bouncer.notWhitelisted", {}, "pl")).toBe("You are not whitelisted.");
  });

  it("returns the key itself when no translation exists in any locale", () => {
    const i18nServiceInstance = createI18nService();

    expect(i18nServiceInstance.t("does.not.exist")).toBe("does.not.exist");
  });

  it("exposes the default locale and which locales are loaded", () => {
    const i18nServiceInstance = createI18nService();

    expect(i18nServiceInstance.getDefaultLocale()).toBe("en");
    expect(i18nServiceInstance.hasLocale("pl")).toBe(true);
    expect(i18nServiceInstance.hasLocale("de")).toBe(false);
  });
});
