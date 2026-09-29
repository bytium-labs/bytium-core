import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { InstanceStateEnum } from "@core/enums/instance-state.enum";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { CircularDependencyResolver } from "@core/resolvers/circular-dependency.resolver";
import { HandlerRegistrar } from "@core/registrars/handler.registrar";
import { ExternalResourceResolver } from "@core/resolvers/external-resource.resolver";
import { ContextualResolver } from "@core/resolvers/contextual.resolver";
import { findOwnerModuleForToken, resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { InstanceEntryModel } from "@core/models/instance-entry.model";
import { GraphTokenType } from "@core/types/graph-token.type";
import { BytiumResourceOptions } from "@core/decorators/bytium-resource.decorator";
import { CircularFactoryPrimitiveException } from "@core/exceptions/circular-factory-primitive.exception";
import { DependencyUndefinedException } from "@core/exceptions/dependency-undefined.exception";
import { ContextualProviderInjectionException } from "@core/exceptions/contextual-provider-injection.exception";
import { PossibleCircularDependencyException } from "@core/exceptions/possible-circular-dependency.exception";
import { instanceOfForwardRefDependency } from "@core/interfaces/forward-ref-dependency.interface";
import { instanceOfOnModuleInit } from "@core/interfaces/on-module-init.interface";
import { unwrapToken } from "@core/utils/unwrap-token.utils";
import { getTokenName } from "@core/utils/token-name.utils";
import { CitizenFXRegistriesInterface } from "@citizenfx/interfaces/citizenfx-registries.interface";
import { BytiumMetadataEnum, ConstructorType, INQUIRER } from "@shared";
import { MODULE_REF_OWNER } from "@shared/consts/module-ref-owner.const";
import { Logger } from "@logger";

export class DependencyResolver {
  readonly #logger = new Logger("bytium");
  readonly #initFiredEntries = new Set<InstanceEntryModel>();
  #currentResolveSession: Set<InstanceEntryModel> | null = null;
  readonly #placeholder: CircularDependencyResolver;
  readonly #handlerRegistrar: HandlerRegistrar;
  readonly #externalResolver: ExternalResourceResolver;
  readonly #contextualResolver: ContextualResolver;

  constructor(
    private readonly graph: DependencyGraph,
    citizenFXRegistries: CitizenFXRegistriesInterface,
  ) {
    this.#placeholder = new CircularDependencyResolver(graph);
    this.#handlerRegistrar = new HandlerRegistrar(graph, citizenFXRegistries, {
      resolveDependency: (token, ownerModule, requester) => this.#resolveDependency(token, ownerModule, requester),
      createInstance: (target, ownerModule) => this.createInstance(target, ownerModule),
    });
    this.#externalResolver = new ExternalResourceResolver(graph, (node, entry) =>
      this.#addInstanceInSession(node, entry),
    );
    this.#contextualResolver = new ContextualResolver(graph, (token, ownerModule, requester) =>
      this.#resolveDependency(token, ownerModule, requester),
    );
  }

  resetLifecycleState(): void {
    this.#initFiredEntries.clear();
  }

  async resolve(token: ConstructorType): Promise<void> {
    const node = this.graph.getNode(token);

    if (!node) {
      throw new DependencyUndefinedException(`Dependency ${getTokenName(token)} not found in graph.`);
    }

    const session = new Set<InstanceEntryModel>();
    const previousSession = this.#currentResolveSession;

    this.#currentResolveSession = session;

    try {
      if (node.type === BytiumDependencyTypeEnum.RESOURCE) {
        await this.#resolveResourceNode(node);
      } else if (node.type === BytiumDependencyTypeEnum.MODULE) {
        await this.#resolveModuleNode(node);
      } else {
        throw new DependencyUndefinedException(`Root ${getTokenName(token)} is not a resource or module.`);
      }
    } catch (error) {
      for (const entry of session) {
        this.graph.removeInstance(entry);
      }

      throw error;
    } finally {
      this.#currentResolveSession = previousSession;
    }
  }

  #addInstanceInSession(node: GraphNodeModel, entry: InstanceEntryModel): void {
    this.graph.addInstance(node, entry);
    this.#currentResolveSession?.add(entry);
  }

  async #resolveResourceNode(node: GraphNodeModel): Promise<InstanceEntryModel> {
    if (node.instances.length > 0) return node.instances[0];

    const resourceClass = node.token as ConstructorType;
    const instance = new resourceClass();
    const entry = new InstanceEntryModel(instance, BytiumProviderScopeEnum.SINGLETON);

    this.#addInstanceInSession(node, entry);

    const resourceOptions = node.metadata.options as BytiumResourceOptions | undefined;
    const externalResourceTimeoutMs = resourceOptions?.externalResourceTimeoutMs ?? 30000;

    for (const importToken of node.getEdgeTargets(GraphEdgeTypeEnum.IMPORTS)) {
      const importedNode = this.graph.getNode(importToken);

      if (importedNode?.type === BytiumDependencyTypeEnum.EXTERNAL_RESOURCE) {
        await this.#externalResolver.resolveExternalResource(importedNode, externalResourceTimeoutMs);
      }
    }

    for (const moduleToken of node.getEdgeTargets(GraphEdgeTypeEnum.CONTAINS)) {
      const moduleNode = this.graph.getNode(moduleToken);

      if (moduleNode?.type === BytiumDependencyTypeEnum.MODULE) {
        await this.#resolveModuleNode(moduleNode);
      }
    }

    this.graph.markResolved(entry);
    await this.#fireOnModuleInitForNewEntries();
    this.#logger.log(`Resource ${resourceClass.name} initialized.`);

    return entry;
  }

  async #resolveModuleNode(node: GraphNodeModel): Promise<InstanceEntryModel> {
    if (node.instances.length > 0) return node.instances[0];

    const moduleClass = (node.metadata.moduleClass ?? node.token) as ConstructorType;
    /**
     * Pre-registered with `null` so cyclic module imports detect us as in-flight via the
     * `node.instances.length > 0` early return above. Module instances are never injected, so
     * filling the real instance in after construction keeps native `#private` fields intact.
     */
    const entry = new InstanceEntryModel(null, BytiumProviderScopeEnum.SINGLETON);

    this.#addInstanceInSession(node, entry);

    for (const importToken of node.getEdgeTargets(GraphEdgeTypeEnum.IMPORTS)) {
      const importedNode = this.graph.getNode(importToken);

      if (importedNode?.type === BytiumDependencyTypeEnum.MODULE) {
        await this.#resolveModuleNode(importedNode);
      } else if (importedNode?.type === BytiumDependencyTypeEnum.EXTERNAL_MODULE) {
        await this.#externalResolver.resolveExternalModule(importedNode);
      }
    }

    for (const containedToken of node.getEdgeTargets(GraphEdgeTypeEnum.CONTAINS)) {
      const containedNode = this.graph.getNode(containedToken);

      if (!containedNode) continue;

      if (
        containedNode.type === BytiumDependencyTypeEnum.PROVIDER ||
        containedNode.type === BytiumDependencyTypeEnum.CONTROLLER
      ) {
        if (
          containedNode.scope === BytiumProviderScopeEnum.TRANSIENT ||
          containedNode.scope === BytiumProviderScopeEnum.CONTEXTUAL
        ) {
          continue;
        }

        if (!containedNode.instances.some((existing) => existing.ownerModule === node)) {
          await this.#resolveProviderInstance(containedNode, node, null);
        }
      } else if (containedNode.type === BytiumDependencyTypeEnum.CUSTOM_PROVIDER) {
        if (
          containedNode.scope === BytiumProviderScopeEnum.TRANSIENT ||
          containedNode.scope === BytiumProviderScopeEnum.CONTEXTUAL
        ) {
          continue;
        }

        if (!containedNode.instances.some((existing) => existing.ownerModule === node)) {
          await this.#resolveCustomProviderInstance(containedNode, node);
        }
      } else if (containedNode.type === BytiumDependencyTypeEnum.MULTI_PROVIDER) {
        if (!containedNode.instances.some((existing) => existing.ownerModule === node)) {
          await this.#resolveDependency(containedToken, node, null);
        }
      } else if (containedNode.type === BytiumDependencyTypeEnum.EXTERNAL_PROVIDER) {
        await this.#externalResolver.resolveExternalProvider(containedNode);
      }
    }

    const constructorParams = node.metadata.constructorParams ?? [];
    const optionalParams = node.metadata.optionalParams ?? [];
    const args = await this.#resolveParams(constructorParams, node, null, optionalParams);
    const instance = new moduleClass(...args);

    entry.instance = instance;

    this.#externalResolver.registerCrossResourceExports(node);
    this.graph.markResolved(entry);
    this.#logger.log(`Module ${moduleClass.name} initialized.`);

    return entry;
  }

  async #fireOnModuleInitForNewEntries(): Promise<void> {
    for (const entry of this.graph.getInstancesInInitOrder()) {
      if (this.#initFiredEntries.has(entry)) continue;

      this.#initFiredEntries.add(entry);

      if (entry.isAlias) continue;

      if (instanceOfOnModuleInit(entry.instance)) {
        await entry.instance.onModuleInit();
      }
    }
  }

  async resolveLazyModule(token: ConstructorType): Promise<void> {
    await this.resolve(token);
    await this.#fireOnModuleInitForNewEntries();
  }

  async resolveByToken<T = unknown>(node: GraphNodeModel, ownerModule: GraphNodeModel): Promise<T> {
    if (node.scope === BytiumProviderScopeEnum.TRANSIENT) {
      const entry = await this.#resolveProviderInstance(node, ownerModule, null);

      return entry.instance as T;
    }

    if (node.instances.length === 0) {
      throw new DependencyUndefinedException(`Provider ${getTokenName(node.token)} has no resolved instance.`);
    }

    const entry = resolveVisibleInstance(this.graph, node.token, ownerModule) ?? node.instances[0];

    return entry.instance as T;
  }

  async createInstance<T>(target: ConstructorType, ownerModule: GraphNodeModel): Promise<T> {
    const params: GraphTokenType[] = Reflect.getMetadata(BytiumMetadataEnum.DESIGN_PARAMTYPES, target) ?? [];
    const optionalParams: number[] = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONAL_PARAMS, target) ?? [];
    const args = await this.#resolveParams(params, ownerModule, null, optionalParams);

    return new target(...args) as T;
  }

  resolveContextual<T = unknown>(
    token: GraphTokenType,
    store: Map<GraphTokenType, unknown>,
    fallbackOwnerModule: GraphNodeModel,
  ): Promise<T> {
    return this.#contextualResolver.resolveContextual<T>(token, store, fallbackOwnerModule);
  }

  /**
   * Two construction paths. With a `forwardRef` in any constructor param: pre-allocate a Proxy
   * placeholder, register it on the graph before resolving deps, then patch the real instance in as
   * the Proxy's target - dependents that captured the placeholder during cycle resolution share the
   * same identity, and method calls forward to the real instance so native `#private` fields work.
   * Otherwise: `new target(...)` directly.
   */
  async #resolveProviderInstance(
    node: GraphNodeModel,
    ownerModule: GraphNodeModel,
    caller: InstanceEntryModel | null,
  ): Promise<InstanceEntryModel> {
    const target = node.token as ConstructorType;
    const scope = node.scope ?? BytiumProviderScopeEnum.SINGLETON;
    const isTransient = scope === BytiumProviderScopeEnum.TRANSIENT;
    const needsPlaceholder = this.#placeholder.needs(node);

    if (isTransient && node.instances.some((entry) => entry.state === InstanceStateEnum.RESOLVING)) {
      throw new PossibleCircularDependencyException(
        `Circular dependency detected between transient providers involving "${target.name}".`,
      );
    }

    const placeholder = needsPlaceholder ? this.#placeholder.create(target) : null;
    const entry = new InstanceEntryModel(
      placeholder,
      scope,
      isTransient ? null : ownerModule,
      isTransient ? caller : null,
    );

    this.#addInstanceInSession(node, entry);

    try {
      const params = await this.#resolveParams(
        node.metadata.constructorParams ?? [],
        ownerModule,
        entry,
        node.metadata.optionalParams ?? [],
      );
      const instance = new target(...params);

      if (placeholder) {
        this.#placeholder.patch(placeholder, instance);
        await this.#assignPropertyInjections(placeholder, node, ownerModule, entry);
        await this.#handlerRegistrar.register(placeholder, target, ownerModule);
      } else {
        entry.instance = instance;
        await this.#assignPropertyInjections(instance, node, ownerModule, entry);
        await this.#handlerRegistrar.register(instance, target, ownerModule);
      }

      this.graph.markResolved(entry);
      this.#logger.log(`Provider ${target.name} initialized${isTransient ? " (transient)" : ""}.`);

      return entry;
    } catch (error) {
      this.graph.removeInstance(entry);

      throw error;
    }
  }

  async #assignPropertyInjections(
    instance: object,
    node: GraphNodeModel,
    ownerModule: GraphNodeModel,
    requester: InstanceEntryModel,
  ): Promise<void> {
    const propertyInjections = node.metadata.propertyInjections ?? [];

    for (const injection of propertyInjections) {
      const resolved = await this.#resolveParam(
        injection.token as unknown as GraphTokenType,
        ownerModule,
        requester,
        injection.optional ?? false,
      );

      (instance as Record<string | symbol, unknown>)[injection.propertyKey] = resolved;
    }
  }

  async #resolveCustomProviderInstance(node: GraphNodeModel, ownerModule: GraphNodeModel): Promise<InstanceEntryModel> {
    const customProvider = node.metadata.customProvider;

    if (!customProvider) {
      throw new DependencyUndefinedException(`Custom provider ${getTokenName(node.token)} has no configuration.`);
    }

    if ("useValue" in customProvider) {
      const entry = new InstanceEntryModel(customProvider.useValue, BytiumProviderScopeEnum.SINGLETON, ownerModule);

      this.#addInstanceInSession(node, entry);
      this.graph.markResolved(entry);

      return entry;
    }

    if ("useFactory" in customProvider) {
      return this.#resolveFactoryProvider(node, ownerModule, customProvider);
    }

    if ("useClass" in customProvider) {
      const useClass = customProvider.useClass;
      const useClassNode = this.graph.getNode(useClass);
      const needsPlaceholder = useClassNode ? this.#placeholder.needs(useClassNode) : false;
      const placeholder = needsPlaceholder ? this.#placeholder.create(useClass) : null;
      const entry = new InstanceEntryModel(placeholder, node.scope ?? BytiumProviderScopeEnum.SINGLETON, ownerModule);

      this.#addInstanceInSession(node, entry);

      const params = await this.#resolveParams(
        useClassNode?.metadata.constructorParams ?? [],
        ownerModule,
        entry,
        useClassNode?.metadata.optionalParams ?? [],
      );
      const instance = new useClass(...params);

      if (placeholder) {
        this.#placeholder.patch(placeholder, instance);

        if (useClassNode) {
          await this.#assignPropertyInjections(placeholder, useClassNode, ownerModule, entry);
        }

        await this.#handlerRegistrar.register(placeholder, useClass, ownerModule);
      } else {
        entry.instance = instance;

        if (useClassNode) {
          await this.#assignPropertyInjections(instance, useClassNode, ownerModule, entry);
        }

        await this.#handlerRegistrar.register(instance, useClass, ownerModule);
      }

      this.graph.markResolved(entry);

      return entry;
    }

    if ("useExisting" in customProvider) {
      const existingInstance = await this.#resolveDependency(customProvider.useExisting, ownerModule, null);
      const entry = new InstanceEntryModel(
        existingInstance,
        BytiumProviderScopeEnum.SINGLETON,
        ownerModule,
        null,
        true,
      );

      this.#addInstanceInSession(node, entry);
      this.graph.markResolved(entry);

      return entry;
    }

    throw new DependencyUndefinedException(`Custom provider ${getTokenName(node.token)} has an invalid configuration.`);
  }

  /**
   * When a transient dependency is injected into the factory it must capture the not-yet-produced
   * factory result as its INQUIRER - so a placeholder is created up front and mutated into the
   * result. Without one, the result is registered as-is and keeps its identity.
   */
  async #resolveFactoryProvider(
    node: GraphNodeModel,
    ownerModule: GraphNodeModel,
    customProvider: { useFactory: (...args: unknown[]) => unknown; inject?: Array<unknown> },
  ): Promise<InstanceEntryModel> {
    const rawInject = customProvider.inject ?? [];
    const tokens: GraphTokenType[] = [];
    const optionalIndices: number[] = [];

    for (let i = 0; i < rawInject.length; i++) {
      const dependency = rawInject[i];
      const isOptionalRef =
        typeof dependency === "object" &&
        dependency !== null &&
        "optional" in dependency &&
        (dependency as { optional?: unknown }).optional === true;

      if (isOptionalRef) {
        tokens.push((dependency as unknown as { token: GraphTokenType }).token);
        optionalIndices.push(i);
      } else {
        tokens.push(dependency as GraphTokenType);
      }
    }

    const hasTransientDependency = tokens.some((token) => {
      const dependencyNode = this.graph.getNode(unwrapToken(token) ?? token);

      return dependencyNode?.scope === BytiumProviderScopeEnum.TRANSIENT;
    });
    const hasCyclicForwardRef = tokens.some((token) => {
      if (!instanceOfForwardRefDependency(token)) return false;

      const unwrapped = unwrapToken(token);

      if (!unwrapped) return false;

      const depNode = this.graph.getNode(unwrapped);

      if (!depNode) return false;

      return this.#placeholder.hasDependencyPathTo(depNode, node);
    });
    const needsPlaceholder = hasTransientDependency || hasCyclicForwardRef;

    if (needsPlaceholder) {
      const placeholder: Record<string, unknown> = {};
      const entry = new InstanceEntryModel(placeholder, BytiumProviderScopeEnum.SINGLETON, ownerModule);

      this.#addInstanceInSession(node, entry);

      const dependencies = await this.#resolveParams(tokens, ownerModule, entry, optionalIndices);
      const result = await customProvider.useFactory(...dependencies);

      if (result !== null && typeof result === "object") {
        Object.setPrototypeOf(placeholder, Object.getPrototypeOf(result));
        Object.assign(placeholder, result);
      } else if (hasCyclicForwardRef) {
        throw new CircularFactoryPrimitiveException(
          `useFactory provider "${getTokenName(node.token)}" uses forwardRef in its inject array and returned a ` +
            `${typeof result} (${JSON.stringify(result)}). Primitives cannot be patched into the placeholder ` +
            `reference captured by the dependent that started the cycle. ` +
            `Fix: return an object (e.g. { value: ${JSON.stringify(result)} }) from the factory, or restructure ` +
            `to avoid the cycle.`,
        );
      }

      this.graph.markResolved(entry);

      return entry;
    }

    const dependencies = await this.#resolveParams(tokens, ownerModule, null, optionalIndices);
    const result = await customProvider.useFactory(...dependencies);
    const entry = new InstanceEntryModel(result, node.scope ?? BytiumProviderScopeEnum.SINGLETON, ownerModule);

    this.#addInstanceInSession(node, entry);
    this.graph.markResolved(entry);

    return entry;
  }

  async #resolveParams(
    params: GraphTokenType[],
    ownerModule: GraphNodeModel,
    requester: InstanceEntryModel | null,
    optionalIndices: number[] = [],
  ): Promise<unknown[]> {
    const resolved: unknown[] = [];
    const optionalSet = new Set(optionalIndices);

    for (let index = 0; index < params.length; index++) {
      resolved.push(await this.#resolveParam(params[index], ownerModule, requester, optionalSet.has(index)));
    }

    return resolved;
  }

  async #resolveParam(
    param: GraphTokenType,
    ownerModule: GraphNodeModel,
    requester: InstanceEntryModel | null,
    isOptional = false,
  ): Promise<unknown> {
    if (param === INQUIRER) {
      return requester?.caller?.instance ?? null;
    }

    if (param === MODULE_REF_OWNER) {
      return ownerModule;
    }

    if (!param && isOptional) return undefined;

    const token = instanceOfForwardRefDependency(param) ? param.forwardRef() : param;

    try {
      return await this.#resolveDependency(token, ownerModule, requester);
    } catch (error) {
      if (isOptional) return undefined;

      throw error;
    }
  }

  async #resolveDependency(
    token: GraphTokenType,
    ownerModule: GraphNodeModel,
    requester: InstanceEntryModel | null,
  ): Promise<unknown> {
    const node = this.graph.getNode(token);

    if (!node) {
      throw new DependencyUndefinedException(`Dependency ${getTokenName(token)} not found in graph.`);
    }

    if (node.type === BytiumDependencyTypeEnum.MULTI_PROVIDER) {
      const existing = resolveVisibleInstance(this.graph, token, ownerModule);

      if (existing) return existing.instance;

      const declaringOwner = findOwnerModuleForToken(this.graph, token, ownerModule) ?? ownerModule;
      const instances: unknown[] = [];

      for (const memberToken of node.metadata.multiMembers ?? []) {
        instances.push(await this.#resolveDependency(memberToken, declaringOwner, requester));
      }

      const entry = new InstanceEntryModel(instances, BytiumProviderScopeEnum.SINGLETON, declaringOwner, null, true);

      this.#addInstanceInSession(node, entry);
      this.graph.markResolved(entry);

      return instances;
    }

    if (node.type === BytiumDependencyTypeEnum.PROVIDER) {
      if (node.scope === BytiumProviderScopeEnum.CONTEXTUAL) {
        throw new ContextualProviderInjectionException(
          `Provider "${getTokenName(token)}" is contextual-scoped and cannot be injected into an eager (singleton) ` +
            `provider - it is instantiated per context by its driver (e.g. one instance per HTTP request).`,
        );
      }

      const declaringOwner = findOwnerModuleForToken(this.graph, token, ownerModule) ?? ownerModule;

      if (node.scope === BytiumProviderScopeEnum.TRANSIENT) {
        return (await this.#resolveProviderInstance(node, declaringOwner, requester)).instance;
      }

      const existing = resolveVisibleInstance(this.graph, token, ownerModule);

      if (existing) return existing.instance;

      return (await this.#resolveProviderInstance(node, declaringOwner, null)).instance;
    }

    if (node.type === BytiumDependencyTypeEnum.CUSTOM_PROVIDER) {
      if (node.scope === BytiumProviderScopeEnum.TRANSIENT) {
        /**
         * Passes `ownerModule` (the module it is injected into, not the declaring one) so the
         * framework `MODULE_REF_OWNER` sentinel resolves `ModuleRef` to that module. Trade-off:
         * a transient CUSTOM_PROVIDER whose deps live only in its declaring scope can't reach them.
         */
        return (await this.#resolveCustomProviderInstance(node, ownerModule)).instance;
      }

      const existing = resolveVisibleInstance(this.graph, token, ownerModule);

      if (existing) return existing.instance;

      const declaringOwner = findOwnerModuleForToken(this.graph, token, ownerModule) ?? ownerModule;

      return (await this.#resolveCustomProviderInstance(node, declaringOwner)).instance;
    }

    if (node.type === BytiumDependencyTypeEnum.EXTERNAL_PROVIDER) {
      return this.#externalResolver.resolveExternalProvider(node);
    }

    throw new DependencyUndefinedException(`Dependency ${getTokenName(token)} cannot be injected (type ${node.type}).`);
  }

  registerControllerPipeline(target: ConstructorType, methodName: string): Promise<void> {
    return this.#handlerRegistrar.registerControllerPipeline(target, methodName);
  }
}
