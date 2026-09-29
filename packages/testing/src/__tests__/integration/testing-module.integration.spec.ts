import "reflect-metadata";
import { BytiumProviderScopeEnum, BytiumResourceModule, Inject, Injectable, Optional } from "@bytium-core/common";
import { Test } from "@testing/classes/test.class";

describe("Testing module", () => {
  describe("basic resolution", () => {
    it("should resolve a provider declared in providers", async () => {
      @Injectable()
      class DependencyProviderA {
        public value = 42;
      }

      const testingModuleInstance = await Test.createTestingModule({
        providers: [DependencyProviderA],
      }).compile();
      const dependencyProviderAInstance = testingModuleInstance.get<DependencyProviderA>(DependencyProviderA);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);
      expect(dependencyProviderAInstance.value).toBe(42);

      await testingModuleInstance.close();
    });

    it("should resolve constructor dependencies between providers", async () => {
      @Injectable()
      class DependencyProviderA {}

      @Injectable()
      class DependentProviderA {
        constructor(public dependencyProviderA: DependencyProviderA) {}
      }

      const testingModuleInstance = await Test.createTestingModule({
        providers: [DependencyProviderA, DependentProviderA],
      }).compile();
      const dependencyProviderAInstance = testingModuleInstance.get<DependencyProviderA>(DependencyProviderA);
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance.dependencyProviderA).toBe(dependencyProviderAInstance);

      await testingModuleInstance.close();
    });

    it("should throw when get is called for an unregistered token", async () => {
      const UNKNOWN_TOKEN = "UNKNOWN_TOKEN";
      const testingModuleInstance = await Test.createTestingModule({}).compile();

      expect(() => testingModuleInstance.get(UNKNOWN_TOKEN)).toThrow(/not found/);

      await testingModuleInstance.close();
    });

    it("should restrict get() to the root module scope when strict is true", async () => {
      @Injectable()
      class HiddenProviderA {
        public marker = "hidden";
      }

      @BytiumResourceModule({
        name: "hiddenModule",
        providers: [HiddenProviderA],
      })
      class HiddenModule {}

      const testingModuleInstance = await Test.createTestingModule({
        imports: [HiddenModule],
      }).compile();
      const hiddenProviderAInstance = testingModuleInstance.get<HiddenProviderA>(HiddenProviderA);

      expect(hiddenProviderAInstance).toBeInstanceOf(HiddenProviderA);
      expect(() => testingModuleInstance.get(HiddenProviderA, { strict: true })).toThrow(/strict/);

      await testingModuleInstance.close();
    });
  });

  describe("overrideProvider", () => {
    it("should replace a provider with useValue", async () => {
      @Injectable()
      class DependencyProviderA {
        public source = "original";
      }

      const testingModuleInstance = await Test.createTestingModule({
        providers: [DependencyProviderA],
      })
        .overrideProvider(DependencyProviderA)
        .useValue({ source: "overridden" })
        .compile();
      const dependencyProviderAInstance = testingModuleInstance.get<DependencyProviderA>(DependencyProviderA);

      expect(dependencyProviderAInstance.source).toBe("overridden");

      await testingModuleInstance.close();
    });

    it("should replace a provider with useFactory", async () => {
      @Injectable()
      class DependencyProviderB {
        public seed = 5;
      }

      @Injectable()
      class DependencyProviderA {
        public value = 1;
      }

      const testingModuleInstance = await Test.createTestingModule({
        providers: [DependencyProviderA, DependencyProviderB],
      })
        .overrideProvider(DependencyProviderA)
        .useFactory({
          factory: (dependencyProviderBInstance: DependencyProviderB) => ({
            value: dependencyProviderBInstance.seed * 2,
          }),
          inject: [DependencyProviderB],
        })
        .compile();
      const dependencyProviderAInstance = testingModuleInstance.get<DependencyProviderA>(DependencyProviderA);

      expect(dependencyProviderAInstance.value).toBe(10);

      await testingModuleInstance.close();
    });

    it("should support a symbol token in a useFactory override inject", async () => {
      const CONFIG_TOKEN = Symbol("CONFIG");

      @Injectable()
      class DependencyProviderA {
        public source = "original";
      }

      const testingModuleInstance = await Test.createTestingModule({
        providers: [{ provide: CONFIG_TOKEN, useValue: "from-symbol" }, DependencyProviderA],
      })
        .overrideProvider(DependencyProviderA)
        .useFactory({
          factory: (config: string) => ({ source: config }),
          inject: [CONFIG_TOKEN],
        })
        .compile();
      const dependencyProviderAInstance = testingModuleInstance.get<DependencyProviderA>(DependencyProviderA);

      expect(dependencyProviderAInstance.source).toBe("from-symbol");

      await testingModuleInstance.close();
    });

    it("should replace a provider with useClass", async () => {
      @Injectable()
      class DependencyProviderA {
        public source = "original";
      }

      @Injectable()
      class DependencyProviderB {
        public source = "replacement";
      }

      const testingModuleInstance = await Test.createTestingModule({
        providers: [DependencyProviderA],
      })
        .overrideProvider(DependencyProviderA)
        .useClass(DependencyProviderB)
        .compile();
      const dependencyProviderAInstance = testingModuleInstance.get<DependencyProviderA>(DependencyProviderA);

      expect((dependencyProviderAInstance as unknown as DependencyProviderB).source).toBe("replacement");

      await testingModuleInstance.close();
    });

    it("should alias an override to an existing provider via useExisting", async () => {
      const ALIAS_TOKEN = "ALIAS_TOKEN";

      @Injectable()
      class DependencyProviderA {}

      const testingModuleInstance = await Test.createTestingModule({
        providers: [DependencyProviderA, { provide: ALIAS_TOKEN, useValue: "placeholder" }],
      })
        .overrideProvider(ALIAS_TOKEN)
        .useExisting(DependencyProviderA)
        .compile();
      const aliasedInstance = testingModuleInstance.get(ALIAS_TOKEN);
      const dependencyProviderAInstance = testingModuleInstance.get<DependencyProviderA>(DependencyProviderA);

      expect(aliasedInstance).toBe(dependencyProviderAInstance);

      await testingModuleInstance.close();
    });

    it("should override a custom-provider token registered in an imported module", async () => {
      const SHARED_TOKEN = "SHARED_TOKEN";

      @BytiumResourceModule({
        name: "providingModule",
        providers: [{ provide: SHARED_TOKEN, useValue: "from-imported-module" }],
        exports: [SHARED_TOKEN],
      })
      class ProvidingModule {}

      const testingModuleInstance = await Test.createTestingModule({
        imports: [ProvidingModule],
      })
        .overrideProvider(SHARED_TOKEN)
        .useValue("overridden")
        .compile();
      const sharedValue = testingModuleInstance.get<string>(SHARED_TOKEN);

      expect(sharedValue).toBe("overridden");

      await testingModuleInstance.close();
    });

    it("should override a class provider registered in an imported module", async () => {
      @Injectable()
      class DependencyProviderA {
        public source = "original";
      }

      @BytiumResourceModule({
        name: "providingModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ProvidingModule {}

      const testingModuleInstance = await Test.createTestingModule({
        imports: [ProvidingModule],
      })
        .overrideProvider(DependencyProviderA)
        .useValue({ source: "overridden" })
        .compile();
      const dependencyProviderAInstance = testingModuleInstance.get<DependencyProviderA>(DependencyProviderA);

      expect(dependencyProviderAInstance.source).toBe("overridden");

      await testingModuleInstance.close();
    });

    it("should throw when overrideProvider targets a token that does not exist in the graph", async () => {
      @Injectable()
      class DependencyProviderA {}

      await expect(
        Test.createTestingModule({
          providers: [DependencyProviderA],
        })
          .overrideProvider("NON_EXISTENT_TOKEN")
          .useValue("mock")
          .compile(),
      ).rejects.toThrow(/Cannot override "NON_EXISTENT_TOKEN"/);
    });

    it("should preserve the original TRANSIENT scope when overriding a TRANSIENT provider declared in an imported module", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        public marker = Symbol("original");
      }

      @BytiumResourceModule({
        name: "providingModule",
        providers: [TransientProviderA],
        exports: [TransientProviderA],
      })
      class ProvidingModule {}

      @Injectable()
      class DependentProviderA {
        constructor(public transientProviderA: TransientProviderA) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(public transientProviderA: TransientProviderA) {}
      }

      class TransientReplacement {
        public marker = Symbol("replacement");
      }

      const testingModuleInstance = await Test.createTestingModule({
        imports: [ProvidingModule],
        providers: [DependentProviderA, DependentProviderB],
      })
        .overrideProvider(TransientProviderA)
        .useClass(TransientReplacement)
        .compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);
      const dependentProviderBInstance = testingModuleInstance.get<DependentProviderB>(DependentProviderB);

      expect(dependentProviderAInstance.transientProviderA).toBeInstanceOf(TransientReplacement);

      expect(dependentProviderBInstance.transientProviderA).toBeInstanceOf(TransientReplacement);
      expect(dependentProviderBInstance.transientProviderA).not.toBe(dependentProviderAInstance.transientProviderA);

      await testingModuleInstance.close();
    });
  });

  describe("imports and modules", () => {
    it("should resolve providers exported by an imported module", async () => {
      @Injectable()
      class DependencyProviderA {}

      @BytiumResourceModule({
        name: "importedModule",
        providers: [DependencyProviderA],
        exports: [DependencyProviderA],
      })
      class ImportedModule {}

      const testingModuleInstance = await Test.createTestingModule({
        imports: [ImportedModule],
      }).compile();
      const dependencyProviderAInstance = testingModuleInstance.get<DependencyProviderA>(DependencyProviderA);

      expect(dependencyProviderAInstance).toBeInstanceOf(DependencyProviderA);

      await testingModuleInstance.close();
    });
  });

  describe("lifecycle hooks", () => {
    it("should fire onModuleInit on providers during compile", async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        async onModuleInit() {
          callLog.push("init");
        }
      }

      const testingModuleInstance = await Test.createTestingModule({
        providers: [DependencyProviderA],
      }).compile();

      expect(callLog).toEqual(["init"]);

      await testingModuleInstance.close();
    });

    it("should fire onModuleDestroy on providers during close", async () => {
      const callLog: string[] = [];

      @Injectable()
      class DependencyProviderA {
        async onModuleDestroy() {
          callLog.push("destroy");
        }
      }

      const testingModuleInstance = await Test.createTestingModule({
        providers: [DependencyProviderA],
      }).compile();

      expect(callLog).toEqual([]);

      await testingModuleInstance.close();

      expect(callLog).toEqual(["destroy"]);
    });
  });

  describe("@Optional support", () => {
    it("should inject undefined for an @Optional dependency that is not registered", async () => {
      const MISSING_TOKEN = "MISSING_TOKEN";

      @Injectable()
      class DependentProviderA {
        constructor(@Optional() @Inject(MISSING_TOKEN) public maybeValue?: string) {}
      }

      const testingModuleInstance = await Test.createTestingModule({
        providers: [DependentProviderA],
      }).compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);

      expect(dependentProviderAInstance).toBeInstanceOf(DependentProviderA);
      expect(dependentProviderAInstance.maybeValue).toBeUndefined();

      await testingModuleInstance.close();
    });
  });

  describe("transient providers", () => {
    it("should create distinct transient instances per dependent", async () => {
      @Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
      class TransientProviderA {
        public createdAt = Math.random();
      }

      @Injectable()
      class DependentProviderA {
        constructor(public transientProviderA: TransientProviderA) {}
      }

      @Injectable()
      class DependentProviderB {
        constructor(public transientProviderA: TransientProviderA) {}
      }

      const testingModuleInstance = await Test.createTestingModule({
        providers: [TransientProviderA, DependentProviderA, DependentProviderB],
      }).compile();
      const dependentProviderAInstance = testingModuleInstance.get<DependentProviderA>(DependentProviderA);
      const dependentProviderBInstance = testingModuleInstance.get<DependentProviderB>(DependentProviderB);

      expect(dependentProviderAInstance.transientProviderA).toBeInstanceOf(TransientProviderA);

      expect(dependentProviderBInstance.transientProviderA).toBeInstanceOf(TransientProviderA);

      expect(dependentProviderAInstance.transientProviderA).not.toBe(dependentProviderBInstance.transientProviderA);

      await testingModuleInstance.close();
    });
  });
});
