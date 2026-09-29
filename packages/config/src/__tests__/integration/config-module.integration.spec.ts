import "reflect-metadata";
import { BytiumResourceModule, Inject, Injectable } from "@bytium-core/common";
import { Test } from "@bytium-core/testing";
import { ConfigModule } from "@config/config.module";
import { ConfigService } from "@config/services/config.service";
import { registerAs } from "@config/utils/register-as";

describe("ConfigModule", () => {
  beforeEach(() => {
    (global as any).LoadResourceFile = (_resource: string, _file: string) => "{}";
    (global as any).GetConvar = (_key: string, defaultValue: string) => defaultValue;
    (global as any).GetConvarInt = (_key: string, defaultValue: number) => defaultValue;
  });

  describe("basic resolution", () => {
    it("should resolve ConfigService from forRoot() with default options", async () => {
      (global as any).LoadResourceFile = () => JSON.stringify({ greeting: "hello" });

      const testingModuleInstance = await Test.createTestingModule({
        imports: [ConfigModule.forRoot()],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(configServiceInstance).toBeInstanceOf(ConfigService);
      expect(configServiceInstance.get("greeting")).toBe("hello");

      await testingModuleInstance.close();
    });

    it("should return defaultValue for missing keys and undefined when no default supplied", async () => {
      (global as any).LoadResourceFile = () => JSON.stringify({ present: 1 });

      const testingModuleInstance = await Test.createTestingModule({
        imports: [ConfigModule.forRoot()],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(configServiceInstance.get("present")).toBe(1);
      expect(configServiceInstance.get("missing")).toBeUndefined();
      expect(configServiceInstance.get("missing", "fallback")).toBe("fallback");

      await testingModuleInstance.close();
    });

    it("should resolve dot-notation keys", async () => {
      (global as any).LoadResourceFile = () => JSON.stringify({ database: { host: "localhost", port: 5432 } });

      const testingModuleInstance = await Test.createTestingModule({
        imports: [ConfigModule.forRoot()],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(configServiceInstance.get("database.host")).toBe("localhost");
      expect(configServiceInstance.get("database.port")).toBe(5432);
      expect(configServiceInstance.get("database.missing")).toBeUndefined();

      await testingModuleInstance.close();
    });

    it("should throw from getOrThrow when key is missing", async () => {
      (global as any).LoadResourceFile = () => JSON.stringify({});

      const testingModuleInstance = await Test.createTestingModule({
        imports: [ConfigModule.forRoot()],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(() => configServiceInstance.getOrThrow("missing")).toThrow(/missing/);

      await testingModuleInstance.close();
    });
  });

  describe("convar helpers", () => {
    it("should read convars through mocked CitizenFX globals", async () => {
      (global as any).GetConvar = (key: string, defaultValue: string) =>
        key === "sv_hostname" ? "test-host" : defaultValue;
      (global as any).GetConvarInt = (key: string, defaultValue: number) =>
        key === "sv_maxclients" ? 64 : defaultValue;

      const testingModuleInstance = await Test.createTestingModule({
        imports: [ConfigModule.forRoot()],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(configServiceInstance.getConvar("sv_hostname")).toBe("test-host");
      expect(configServiceInstance.getConvarInt("sv_maxclients")).toBe(64);
      expect(configServiceInstance.getConvar("missing", "fallback")).toBe("fallback");

      await testingModuleInstance.close();
    });
  });

  describe("global option", () => {
    it("should expose ConfigService to modules that do not import ConfigModule when global: true", async () => {
      (global as any).LoadResourceFile = () => JSON.stringify({ key: "value" });

      @Injectable()
      class DependentProviderA {
        constructor(public configServiceInstance: ConfigService) {}
      }

      @BytiumResourceModule({
        name: "dependentModule",
        providers: [DependentProviderA],
      })
      class DependentModule {}

      const testingModuleInstance = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ global: true }), DependentModule],
      }).compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance.configServiceInstance).toBeInstanceOf(ConfigService);
      expect(dependentProviderAInstance.configServiceInstance.get("key")).toBe("value");

      await testingModuleInstance.close();
    });
  });

  describe("load option", () => {
    it("should merge keys from multiple loader functions into the ConfigService", async () => {
      const primaryLoader = () => ({ primary: { host: "primary-host" } });
      const secondaryLoader = () => ({ secondary: { host: "secondary-host" } });
      const testingModuleInstance = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ load: [primaryLoader, secondaryLoader] })],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(configServiceInstance.get("primary.host")).toBe("primary-host");
      expect(configServiceInstance.get("secondary.host")).toBe("secondary-host");

      await testingModuleInstance.close();
    });

    it("should let later loaders override earlier loaders on conflicting top-level keys", async () => {
      const earlierLoader = () => ({ shared: "earlier" });
      const laterLoader = () => ({ shared: "later" });
      const testingModuleInstance = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ load: [earlierLoader, laterLoader] })],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(configServiceInstance.get("shared")).toBe("later");

      await testingModuleInstance.close();
    });
  });

  describe("registerAs helper", () => {
    it("should expose loader output under the registered namespace", async () => {
      const databaseConfig = registerAs("database", () => ({ host: "db-host", port: 5432 }));
      const testingModuleInstance = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ load: [databaseConfig] })],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(configServiceInstance.get("database.host")).toBe("db-host");
      expect(configServiceInstance.get("database.port")).toBe(5432);

      await testingModuleInstance.close();
    });
  });

  describe("ignoreEnvFile option", () => {
    it("should skip reading the JSON config file when ignoreEnvFile is true", async () => {
      const loadResourceFileMock = jest.fn();

      (global as any).LoadResourceFile = loadResourceFileMock;

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            ignoreEnvFile: true,
            load: [() => ({ source: "loader-only" })],
          }),
        ],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(loadResourceFileMock).not.toHaveBeenCalled();
      expect(configServiceInstance.get("source")).toBe("loader-only");

      await testingModuleInstance.close();
    });
  });

  describe("validationSchema option", () => {
    it("should apply the schema's validate() result as the active config", async () => {
      const schema = {
        validate: jest.fn((input: Record<string, any>) => ({
          value: { ...input, validated: true },
        })),
      };
      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [() => ({ source: "raw" })],
            validationSchema: schema,
          }),
        ],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(schema.validate).toHaveBeenCalledWith({ source: "raw" });
      expect(configServiceInstance.get("validated")).toBe(true);
      expect(configServiceInstance.get("source")).toBe("raw");

      await testingModuleInstance.close();
    });

    it("should propagate the schema's error when validate() returns one", async () => {
      const schema = {
        validate: () => ({ error: new Error("schema rejected") }),
      };

      await expect(
        Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              load: [() => ({ source: "raw" })],
              validationSchema: schema,
            }),
          ],
        }).compile(),
      ).rejects.toThrow(/schema rejected/);
    });
  });

  describe("validate option", () => {
    it("should apply the validate function and use its returned value as the active config", async () => {
      const validatorFn = jest.fn((cfg: Record<string, any>) => ({ ...cfg, validated: true }));
      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [() => ({ source: "raw" })],
            validate: validatorFn,
          }),
        ],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(validatorFn).toHaveBeenCalledWith({ source: "raw" });
      expect(configServiceInstance.get("source")).toBe("raw");
      expect(configServiceInstance.get("validated")).toBe(true);

      await testingModuleInstance.close();
    });

    it("should propagate the error when the validate function throws", async () => {
      const validatorFn = () => {
        throw new Error("invalid config: missing 'host'");
      };

      await expect(
        Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              load: [() => ({ source: "raw" })],
              validate: validatorFn,
            }),
          ],
        }).compile(),
      ).rejects.toThrow(/invalid config: missing 'host'/);
    });
  });

  describe("expandVariables option", () => {
    it("should interpolate ${VAR} placeholders against other config values", async () => {
      const loaderFn = () => ({
        database: { host: "db.local", port: 5432 },
        connection: { url: "postgres://${database.host}:${database.port}/app" },
      });
      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [loaderFn],
            expandVariables: true,
          }),
        ],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(configServiceInstance.get("connection.url")).toBe("postgres://db.local:5432/app");

      await testingModuleInstance.close();
    });

    it("should leave unresolved placeholders untouched when expandVariables is enabled", async () => {
      const loaderFn = () => ({ greeting: "hello ${missing.key}" });
      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [loaderFn],
            expandVariables: true,
          }),
        ],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(configServiceInstance.get("greeting")).toBe("hello ${missing.key}");

      await testingModuleInstance.close();
    });
  });

  describe("forFeature with registerAs", () => {
    it("should expose a typed namespace payload through the loader's KEY token", async () => {
      const databaseConfig = registerAs("database", () => ({ host: "feature-host", port: 9999 }));

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(databaseConfig.KEY) public dbCfg: { host: string; port: number }) {}
      }

      @BytiumResourceModule({
        name: "dependentModule",
        imports: [ConfigModule.forFeature(databaseConfig)],
        providers: [DependentProviderA],
      })
      class DependentModule {}

      const testingModuleInstance = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ load: [databaseConfig], global: true }), DependentModule],
      }).compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);

      expect(dependentProviderAInstance.dbCfg).toEqual({ host: "feature-host", port: 9999 });

      await testingModuleInstance.close();
    });

    it("should reflect forRoot's expandVariables processing in the injected namespace", async () => {
      const databaseConfig = registerAs("database", () => ({ host: "${HOST}" }));

      @Injectable()
      class DependentProviderA {
        constructor(@Inject(databaseConfig.KEY) public readonly dbCfg: { host: string }) {}
      }

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            load: [() => ({ HOST: "localhost" }), databaseConfig],
            expandVariables: true,
            global: true,
          }),
          ConfigModule.forFeature(databaseConfig),
        ],
        providers: [DependentProviderA],
      }).compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);

      expect(dependentProviderAInstance.dbCfg.host).toBe("localhost");

      await testingModuleInstance.close();
    });
  });

  describe("forRootAsync", () => {
    it("should resolve config options through async useFactory", async () => {
      (global as any).LoadResourceFile = (_resource: string, fileName: string) => {
        if (fileName === "async.json") return JSON.stringify({ asyncKey: "asyncValue" });

        return "{}";
      };

      const testingModuleInstance = await Test.createTestingModule({
        imports: [
          ConfigModule.forRootAsync({
            useFactory: async () => ({ configFilePath: "async.json" }),
          }),
        ],
      }).compile();
      const configServiceInstance = testingModuleInstance.get<ConfigService>(ConfigService);

      expect(configServiceInstance.get("asyncKey")).toBe("asyncValue");

      await testingModuleInstance.close();
    });
  });
});
