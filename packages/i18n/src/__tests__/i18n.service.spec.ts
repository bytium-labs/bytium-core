import { Logger } from "@bytium-core/common";
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
  beforeAll(() => {
    jest
      .spyOn(globalThis, "LoadResourceFile")
      .mockImplementation((_resource: string, path: string) => catalogFiles[path] ?? null);
    jest.spyOn(globalThis, "GetCurrentResourceName").mockReturnValue("test-resource");
  });

  afterAll(() => {
    jest.restoreAllMocks();
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

  it("reports whether a key has a translation in the default locale", () => {
    const i18nServiceInstance = createI18nService();

    expect(i18nServiceInstance.has("greeting")).toBe(true);
    expect(i18nServiceInstance.has("bouncer.notWhitelisted")).toBe(true);
    expect(i18nServiceInstance.has("does.not.exist")).toBe(false);
  });

  it("reports a key missing in the requested locale as translated when the fallback locale has it", () => {
    const i18nServiceInstance = createI18nService();

    expect(i18nServiceInstance.has("bouncer.notWhitelisted", "pl")).toBe(true);
  });

  it("warns once per key and locale about a key with no translation in any locale, but not when only checking it", () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const i18nServiceInstance = createI18nService();

    i18nServiceInstance.t("does.not.exist");
    i18nServiceInstance.t("does.not.exist");
    i18nServiceInstance.t("does.not.exist", {}, "pl");
    i18nServiceInstance.t("greeting", { name: "Ada" });
    i18nServiceInstance.has("also.does.not.exist");

    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenNthCalledWith(1, expect.stringContaining('"does.not.exist"'));
    expect(warnSpy).toHaveBeenNthCalledWith(1, expect.stringContaining('"en"'));
    expect(warnSpy).toHaveBeenNthCalledWith(2, expect.stringContaining('"pl"'));

    warnSpy.mockRestore();
  });

  it("exposes the default locale and which locales are loaded", () => {
    const i18nServiceInstance = createI18nService();

    expect(i18nServiceInstance.getDefaultLocale()).toBe("en");
    expect(i18nServiceInstance.hasLocale("pl")).toBe(true);
    expect(i18nServiceInstance.hasLocale("de")).toBe(false);
  });
});
