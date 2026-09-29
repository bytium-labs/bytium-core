import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { GraphNodeOriginEnum } from "@core/enums/graph-node-origin.enum";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { InstanceEntryModel } from "@core/models/instance-entry.model";
import { ModuleRef } from "@core/services/module-ref.service";
import { DiscoveryService } from "@core/services/discovery.service";
import { LazyModuleLoader } from "@core/services/lazy-module-loader.service";
import { BytiumCoreModule } from "@core/modules/bytium-core.module";
import { BytiumDependencyScanner } from "@core/scanners/bytium-dependency.scanner";
import { DependencyValidator } from "@core/validators/dependency.validator";
import { DependencyResolver } from "@core/resolvers/dependency.resolver";
import { ScopeMapsInterface } from "@core/interfaces/scope-maps.interface";
import { FactoryProviderInterface } from "@core/interfaces/factory-provider.interface";
import { ConcurrentResolveException } from "@core/exceptions/concurrent-resolve.exception";
import { MODULE_REF_OWNER } from "@shared/consts/module-ref-owner.const";
import { instanceOfOnModuleDestroy } from "@core/interfaces/on-module-destroy.interface";
import { instanceOfOnResourceBootstrap } from "@core/interfaces/on-resource-bootstrap.interface";
import { instanceOfOnResourceStarted } from "@core/interfaces/on-resource-started.interface";
import { instanceOfOnResourceShutdown } from "@core/interfaces/on-resource-shutdown.interface";
import { instanceOfBeforeResourceShutdown } from "@core/interfaces/before-resource-shutdown.interface";
import { ConstructorType } from "@shared";
import { Logger } from "@logger";
import { CallbacksRegistry } from "@citizenfx/registries/callbacks.registry";
import { CommandsRegistry } from "@citizenfx/registries/commands.registry";
import { CronJobsRegistry } from "@citizenfx/registries/cron-jobs.registry";
import { EventsRegistry } from "@citizenfx/registries/events.registry";
import { KeyBindsRegistry } from "@citizenfx/registries/key-binds.registry";
import { NUICallbacksRegistry } from "@citizenfx/registries/nui-callbacks.registry";
import { TicksRegistry } from "@citizenfx/registries/ticks.registry";
import { CitizenFXRuntimeManager } from "@citizenfx/managers/citizenfx-runtime.manager";
import { CitizenFXRegistriesInterface } from "@citizenfx/interfaces/citizenfx-registries.interface";

export class BytiumDependencyManager {
  readonly #logger = new Logger("bytium");
  readonly #scanner: BytiumDependencyScanner;
  readonly #validator: DependencyValidator;
  readonly #citizenFXRuntimeManager: CitizenFXRuntimeManager;
  readonly #engine: DependencyResolver;
  #scanned = false;
  #scopeMaps?: ScopeMapsInterface;
  #resolvePromise: Promise<void> | null = null;

  constructor(
    private readonly graph: DependencyGraph = new DependencyGraph(),
    private readonly citizenFXRegistries: CitizenFXRegistriesInterface = {
      callbacksRegistry: new CallbacksRegistry(),
      commandsRegistry: new CommandsRegistry(),
      cronJobsRegistry: new CronJobsRegistry(),
      eventsRegistry: new EventsRegistry(),
      keyBindsRegistry: new KeyBindsRegistry(),
      nuiCallbacksRegistry: new NUICallbacksRegistry(),
      ticksRegistry: new TicksRegistry(),
    },
  ) {
    this.#scanner = new BytiumDependencyScanner(graph);
    this.#validator = new DependencyValidator(graph);
    this.#citizenFXRuntimeManager = new CitizenFXRuntimeManager(
      this.citizenFXRegistries.cronJobsRegistry,
      this.citizenFXRegistries.commandsRegistry,
    );
    this.#engine = new DependencyResolver(graph, this.citizenFXRegistries);
  }

  getDependencyGraph(): DependencyGraph {
    return this.graph;
  }

  scanProviderClass(target: ConstructorType): void {
    this.#scanner.scanProviderMetadataOnly(target);
  }

  async resolve(target: ConstructorType): Promise<void> {
    if (this.#resolvePromise) {
      throw new ConcurrentResolveException(
        `BytiumDependencyManager.resolve() is already in progress. Await the existing call before starting another.`,
      );
    }

    this.#resolvePromise = (async () => {
      try {
        this.scan(target);
        this.seedFrameworkProviders();
        this.validate();
        await this.instantiate(target);
      } finally {
        this.#resolvePromise = null;
      }
    })();

    return this.#resolvePromise;
  }

  scan(target: ConstructorType): void {
    if (this.#scanned) return;

    this.#scanner.scanCoreModule(BytiumCoreModule);
    this.#scanner.scan(target);
    this.#scanned = true;
  }

  seedFrameworkProviders(): void {
    this.#seedModuleRef();
    this.#seedDiscoveryService();
    this.#seedLazyModuleLoader();
  }

  validate(): void {
    try {
      this.#scopeMaps = this.#validator.validateAll();
      this.graph.setScopeMaps(this.#scopeMaps);
    } catch (error) {
      this.#logger.error("Dependency validation failed:", error);

      throw error;
    }
  }

  async instantiate(target: ConstructorType): Promise<void> {
    this.#seedCitizenFXRegistries();

    await this.#engine.resolve(BytiumCoreModule);
    await this.#engine.resolve(target);
  }

  async bootstrapAll(): Promise<void> {
    this.#citizenFXRuntimeManager.ensureCronTickExists();

    for (const entry of this.graph.getInstancesInInitOrder()) {
      if (entry.isAlias) continue;

      const instance = entry.instance;

      if (!instanceOfOnResourceBootstrap(instance)) continue;

      try {
        await instance.onResourceBootstrap();
      } catch (error) {
        this.#logger.error(`Failed to bootstrap ${this.#instanceName(instance)}:`, error);

        throw error;
      }
    }
  }

  async startAll(): Promise<void> {
    for (const entry of this.graph.getInstancesInInitOrder()) {
      if (entry.isAlias) continue;

      const instance = entry.instance;

      if (!instanceOfOnResourceStarted(instance)) continue;

      try {
        await instance.onResourceStarted();
      } catch (error) {
        this.#logger.error(`Failed to start ${this.#instanceName(instance)}:`, error);

        throw error;
      }
    }

    this.#citizenFXRuntimeManager.setupCommandSuggestions();
  }

  async destroyAll(): Promise<void> {
    const reversed = [...this.graph.getInstancesInInitOrder()].reverse();

    for (const entry of reversed) {
      if (entry.isAlias) continue;

      const instance = entry.instance;

      if (!instanceOfOnModuleDestroy(instance)) continue;

      try {
        await instance.onModuleDestroy();
      } catch (error) {
        this.#logger.error(`Failed onModuleDestroy on ${this.#instanceName(instance)}:`, error);
      }
    }

    for (const entry of reversed) {
      if (entry.isAlias) continue;

      const instance = entry.instance;

      if (!instanceOfBeforeResourceShutdown(instance)) continue;

      try {
        await instance.beforeResourceShutdown();
      } catch (error) {
        this.#logger.error(`Failed beforeResourceShutdown on ${this.#instanceName(instance)}:`, error);
      }
    }

    for (const entry of reversed) {
      if (entry.isAlias) continue;

      const instance = entry.instance;

      if (!instanceOfOnResourceShutdown(instance)) continue;

      try {
        await instance.onResourceShutdown();
      } catch (error) {
        this.#logger.error(`Failed onResourceShutdown on ${this.#instanceName(instance)}:`, error);
      }
    }

    this.graph.clear();
    this.#engine.resetLifecycleState();
    this.#scanned = false;
  }

  #seedCitizenFXRegistries(): void {
    const coreModuleNode = this.graph.getNode(BytiumCoreModule);

    if (!coreModuleNode) return;

    const entries: [ConstructorType, object][] = [
      [TicksRegistry, this.citizenFXRegistries.ticksRegistry],
      [CallbacksRegistry, this.citizenFXRegistries.callbacksRegistry],
      [CommandsRegistry, this.citizenFXRegistries.commandsRegistry],
      [CronJobsRegistry, this.citizenFXRegistries.cronJobsRegistry],
      [EventsRegistry, this.citizenFXRegistries.eventsRegistry],
    ];

    for (const [token, instance] of entries) {
      let node = this.graph.getNode(token);

      if (!node) {
        node = new GraphNodeModel(
          token,
          BytiumDependencyTypeEnum.PROVIDER,
          GraphNodeOriginEnum.STATIC,
          {},
          null,
          BytiumProviderScopeEnum.SINGLETON,
        );

        this.graph.addNode(node);
      }

      this.graph.addEdge(BytiumCoreModule, token, GraphEdgeTypeEnum.CONTAINS);

      const entry = new InstanceEntryModel(instance, BytiumProviderScopeEnum.SINGLETON, coreModuleNode);

      this.graph.addInstance(node, entry);
      this.graph.markResolved(entry);
    }
  }

  #seedModuleRef(): void {
    const coreModuleNode = this.graph.getNode(BytiumCoreModule);

    if (!coreModuleNode) return;

    const customProvider = {
      provide: ModuleRef,
      useFactory: (ownerModule: GraphNodeModel) => {
        if (!this.#scopeMaps) {
          throw new Error("ModuleRef requested before dependency scopes were built.");
        }

        return new ModuleRef(this.graph, this.#engine, ownerModule ?? coreModuleNode, this.#scopeMaps);
      },
      inject: [MODULE_REF_OWNER],
    };
    const moduleRefNode = new GraphNodeModel(
      ModuleRef,
      BytiumDependencyTypeEnum.CUSTOM_PROVIDER,
      GraphNodeOriginEnum.STATIC,
      { customProvider },
      coreModuleNode,
      BytiumProviderScopeEnum.TRANSIENT,
    );

    this.graph.addNode(moduleRefNode);
    this.graph.addEdge(BytiumCoreModule, ModuleRef, GraphEdgeTypeEnum.CONTAINS);
    this.graph.addEdge(BytiumCoreModule, ModuleRef, GraphEdgeTypeEnum.EXPORTS);
  }

  #seedDiscoveryService(): void {
    const coreModuleNode = this.graph.getNode(BytiumCoreModule);

    if (!coreModuleNode) return;

    const discoveryService = new DiscoveryService(this.graph);
    const customProvider: FactoryProviderInterface = {
      provide: DiscoveryService,
      useFactory: () => discoveryService,
      inject: [],
    };
    const discoveryServiceNode = new GraphNodeModel(
      DiscoveryService,
      BytiumDependencyTypeEnum.CUSTOM_PROVIDER,
      GraphNodeOriginEnum.STATIC,
      { customProvider },
      coreModuleNode,
      BytiumProviderScopeEnum.SINGLETON,
    );

    this.graph.addNode(discoveryServiceNode);
    this.graph.addEdge(BytiumCoreModule, DiscoveryService, GraphEdgeTypeEnum.CONTAINS);
    this.graph.addEdge(BytiumCoreModule, DiscoveryService, GraphEdgeTypeEnum.EXPORTS);
  }

  #seedLazyModuleLoader(): void {
    const coreModuleNode = this.graph.getNode(BytiumCoreModule);

    if (!coreModuleNode) return;

    const lazyModuleLoader = new LazyModuleLoader(
      this.graph,
      this.#engine,
      (module) => this.#scanner.scanModuleClass(module),
      () => {
        this.#scopeMaps = this.#validator.validateAll();

        return this.#scopeMaps;
      },
    );
    const customProvider: FactoryProviderInterface = {
      provide: LazyModuleLoader,
      useFactory: () => lazyModuleLoader,
      inject: [],
    };
    const lazyModuleLoaderNode = new GraphNodeModel(
      LazyModuleLoader,
      BytiumDependencyTypeEnum.CUSTOM_PROVIDER,
      GraphNodeOriginEnum.STATIC,
      { customProvider },
      coreModuleNode,
      BytiumProviderScopeEnum.SINGLETON,
    );

    this.graph.addNode(lazyModuleLoaderNode);
    this.graph.addEdge(BytiumCoreModule, LazyModuleLoader, GraphEdgeTypeEnum.CONTAINS);
    this.graph.addEdge(BytiumCoreModule, LazyModuleLoader, GraphEdgeTypeEnum.EXPORTS);
  }

  #instanceName(instance: unknown): string {
    return (instance as { constructor?: { name?: string } })?.constructor?.name ?? "instance";
  }
}
