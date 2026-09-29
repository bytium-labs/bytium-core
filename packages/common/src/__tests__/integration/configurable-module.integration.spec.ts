import "reflect-metadata";
import { BytiumResource, BytiumResourceModule, ConfigurableModuleBuilder, Inject, Injectable } from "@core";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ConstructorType } from "@shared";

interface FeatureOptions {
  apiKey: string;
}

describe("ConfigurableModuleBuilder", () => {
  let dependencyGraph: DependencyGraph;
  let dependencyManager: BytiumDependencyManager;
  const getInstance = <T>(token: GraphTokenType, module: ConstructorType): T | undefined => {
    const moduleNode = dependencyGraph.findModuleNode(module);

    return moduleNode ? (resolveVisibleInstance(dependencyGraph, token, moduleNode)?.instance as T) : undefined;
  };

  beforeEach(() => {
    dependencyGraph = new DependencyGraph();
    dependencyManager = new BytiumDependencyManager(dependencyGraph);
  });

  afterEach(async () => {
    await dependencyManager.destroyAll();
  });

  it("should inject the options passed to register() through the options token", async () => {
    const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<FeatureOptions>().build();

    @Injectable()
    class FeatureService {
      constructor(@Inject(MODULE_OPTIONS_TOKEN) public readonly options: FeatureOptions) {}
    }

    @BytiumResourceModule({ name: "featureModule", providers: [FeatureService], exports: [FeatureService] })
    class FeatureModule extends ConfigurableModuleClass {}

    @Injectable()
    class DependentService {
      constructor(public readonly featureService: FeatureService) {}
    }

    @BytiumResourceModule({
      name: "appModule",
      imports: [FeatureModule.register({ apiKey: "static-key" })],
      providers: [DependentService],
    })
    class AppModule {}

    @BytiumResource({ modules: [AppModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const dependentServiceInstance = getInstance<DependentService>(DependentService, AppModule);

    expect(dependentServiceInstance?.featureService.options).toEqual({ apiKey: "static-key" });
  });

  it("should build the options from registerAsync's factory", async () => {
    const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<FeatureOptions>().build();

    @Injectable()
    class FeatureService {
      constructor(@Inject(MODULE_OPTIONS_TOKEN) public readonly options: FeatureOptions) {}
    }

    @BytiumResourceModule({ name: "featureModule", providers: [FeatureService], exports: [FeatureService] })
    class FeatureModule extends ConfigurableModuleClass {}

    @Injectable()
    class DependentService {
      constructor(public readonly featureService: FeatureService) {}
    }

    @BytiumResourceModule({
      name: "appModule",
      imports: [FeatureModule.registerAsync({ useFactory: () => ({ apiKey: "async-key" }) })],
      providers: [DependentService],
    })
    class AppModule {}

    @BytiumResource({ modules: [AppModule] })
    class TestResource {}

    await dependencyManager.resolve(TestResource);

    const dependentServiceInstance = getInstance<DependentService>(DependentService, AppModule);

    expect(dependentServiceInstance?.featureService.options).toEqual({ apiKey: "async-key" });
  });
});
