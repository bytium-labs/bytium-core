import { BytiumResource, BytiumResourceModule, ConstructorType, CustomProviderConfigType } from "@bytium-core/common";
import { BytiumDependencyManager } from "@bytium-core/common/internal/managers/bytium-dependency.manager";
import { DependencyGraph } from "@bytium-core/common/internal/graphs/dependency.graph";
import { applyGraphOverride } from "@bytium-core/common/internal/utils/apply-graph-override.utils";
import { TestingModule } from "@testing/testing.module";
import { TestingModuleMetadata } from "@testing/interfaces/testing-module-metadata.interface";
import { TestingProvider } from "@testing/types/testing-provider.type";
import { ProviderToken } from "@testing/types/provider-token.type";
import { OverrideValue } from "@testing/types/override-value.type";
import { OverrideBuilder } from "@testing/builders/override-builder";

/**
 * Builds a testing module, optionally overriding providers and enhancers before compiling.
 */
export class TestingModuleBuilder {
  private readonly metadata: TestingModuleMetadata;
  private readonly overrides = new Map<ProviderToken, OverrideValue>();
  private readonly matchedTokens = new Set<ProviderToken>();
  private readonly enhancersToScan = new Set<ConstructorType>();

  constructor(metadata: TestingModuleMetadata) {
    this.metadata = {
      imports: metadata.imports ?? [],
      providers: metadata.providers ?? [],
      controllers: metadata.controllers ?? [],
    };
  }

  /** Overrides a provider token; chain `.useValue` / `.useClass` / `.useFactory` / `.useExisting`. */
  overrideProvider(token: ProviderToken): OverrideBuilder {
    return new OverrideBuilder(token, (override) => {
      this.overrides.set(token, override);

      return this;
    });
  }

  /** Replaces a guard class with a mock. Unlike {@link overrideProvider}, the guard need not be a registered provider. */
  overrideGuard(guard: ConstructorType): OverrideBuilder {
    return this.overrideEnhancer(guard);
  }

  /** Replaces a pipe class with a mock - the pipe need not be a registered provider. */
  overridePipe(pipe: ConstructorType): OverrideBuilder {
    return this.overrideEnhancer(pipe);
  }

  /** Replaces an interceptor class with a mock - the interceptor need not be a registered provider. */
  overrideInterceptor(interceptor: ConstructorType): OverrideBuilder {
    return this.overrideEnhancer(interceptor);
  }

  /** Replaces an exception-filter class with a mock - the filter need not be a registered provider. */
  overrideFilter(filter: ConstructorType): OverrideBuilder {
    return this.overrideEnhancer(filter);
  }

  private overrideEnhancer(enhancer: ConstructorType): OverrideBuilder {
    this.enhancersToScan.add(enhancer);

    return new OverrideBuilder(enhancer, (override) => {
      this.overrides.set(enhancer, override);

      return this;
    });
  }

  /** Compiles the configured module and resolves its providers. */
  async compile(): Promise<TestingModule> {
    const providers = this.applyOverrides(this.metadata.providers ?? []);
    const syntheticTestModule = class {} as ConstructorType;

    Object.defineProperty(syntheticTestModule, "name", { value: "TestingRootModule" });
    BytiumResourceModule({
      name: "testingRootModule",
      imports: this.metadata.imports ?? [],
      providers,
      controllers: this.metadata.controllers ?? [],
    })(syntheticTestModule as never);

    const syntheticTestResource = class {} as ConstructorType;

    Object.defineProperty(syntheticTestResource, "name", { value: "TestingRootResource" });
    BytiumResource({ modules: [syntheticTestModule] })(syntheticTestResource as never);

    const dependencyGraph = new DependencyGraph();
    const dependencyManager = new BytiumDependencyManager(dependencyGraph);

    dependencyManager.scan(syntheticTestResource);
    dependencyManager.seedFrameworkProviders();

    for (const enhancer of this.enhancersToScan) {
      if (!dependencyGraph.getNode(enhancer)) dependencyManager.scanProviderClass(enhancer);
    }

    for (const [token, override] of this.overrides) {
      if (this.matchedTokens.has(token)) continue;

      if ("useClass" in override && override.useClass && !dependencyGraph.getNode(override.useClass)) {
        dependencyManager.scanProviderClass(override.useClass);
      }

      applyGraphOverride(dependencyGraph, token, override as unknown as CustomProviderConfigType);
    }

    dependencyManager.validate();
    await dependencyManager.instantiate(syntheticTestResource);
    await dependencyManager.bootstrapAll();

    return new TestingModule(dependencyManager, dependencyGraph, syntheticTestModule);
  }

  private applyOverrides(providers: TestingProvider[]): TestingProvider[] {
    this.matchedTokens.clear();

    if (this.overrides.size === 0) return [...providers];

    return providers.map((provider) => {
      const token = this.getProviderToken(provider);

      if (!token) return provider;

      const override = this.overrides.get(token);

      if (override) {
        this.matchedTokens.add(token);

        return override as TestingProvider;
      }

      return provider;
    });
  }

  private getProviderToken(provider: TestingProvider): ProviderToken | null {
    if (typeof provider === "function") return provider as ConstructorType;

    if (typeof provider === "string") return provider;

    if (typeof provider === "object" && provider !== null && "provide" in provider) {
      return provider.provide;
    }

    return null;
  }
}
