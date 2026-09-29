import { DependencyGraph } from "@core/graphs/dependency.graph";
import { resolveVisibleInstance, isTokenVisible } from "@core/utils/scope-lookup.utils";
import { getTokenName } from "@core/utils/token-name.utils";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { DependencyResolver } from "@core/resolvers/dependency.resolver";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ScopeMapsInterface } from "@core/interfaces/scope-maps.interface";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { DependencyOutOfScopeException } from "@core/exceptions/dependency-out-of-scope.exception";
import { DependencyUndefinedException } from "@core/exceptions/dependency-undefined.exception";
import { TransientProviderGetException } from "@core/exceptions/transient-provider-get.exception";
import { ContextualProviderInjectionException } from "@core/exceptions/contextual-provider-injection.exception";
import { ModuleRefLookupOptions } from "@core/interfaces/module-ref-lookup-options.interface";
import { ConstructorType } from "@shared";

/**
 * Resolves provider instances from the live dependency graph and creates ad-hoc instances of arbitrary classes.
 */
export class ModuleRef {
  constructor(
    private readonly graph: DependencyGraph,
    private readonly engine: DependencyResolver,
    private readonly ownerModule: GraphNodeModel,
    private readonly scopeMaps: ScopeMapsInterface,
  ) {}

  /**
   * Returns the resolved singleton instance for the given token. Defaults to `strict: true`
   * - only tokens visible from this `ModuleRef`'s owner module are accessible.
   */
  get<T = unknown>(token: GraphTokenType, options: ModuleRefLookupOptions = {}): T {
    const strict = options.strict ?? true;
    const node = this.graph.getNode(token);

    if (!node) {
      throw new DependencyUndefinedException(`Provider "${getTokenName(token)}" not found in the dependency graph.`);
    }

    if (strict && !this.#canAccess(token)) {
      throw new DependencyOutOfScopeException(
        `Provider "${getTokenName(token)}" is not accessible from "${getTokenName(this.ownerModule.token)}" - ` +
          `not in scope. Pass { strict: false } to bypass.`,
      );
    }

    if (node.scope === BytiumProviderScopeEnum.TRANSIENT) {
      throw new TransientProviderGetException(
        `Provider "${getTokenName(token)}" is transient-scoped and has no single instance - ` +
          `use moduleRef.resolve() instead of get().`,
      );
    }

    if (node.scope === BytiumProviderScopeEnum.CONTEXTUAL) {
      throw new ContextualProviderInjectionException(
        `Provider "${getTokenName(token)}" is contextual-scoped and has no single instance - ` +
          `it is resolved per context by its driver (e.g. per HTTP request).`,
      );
    }

    if (node.instances.length === 0) {
      throw new DependencyUndefinedException(`Provider "${getTokenName(token)}" has no resolved instance.`);
    }

    const entry = resolveVisibleInstance(this.graph, token, this.ownerModule) ?? node.instances[0];

    return entry.instance as T;
  }

  /**
   * Returns `true` if a token is accessible from this `ModuleRef`'s scope (with the same
   * `strict` semantics as `get()`).
   */
  has(token: GraphTokenType, options: ModuleRefLookupOptions = {}): boolean {
    const strict = options.strict ?? true;
    const node = this.graph.getNode(token);

    if (!node || node.instances.length === 0) return false;

    if (!strict) return true;

    return resolveVisibleInstance(this.graph, token, this.ownerModule) !== undefined;
  }

  /**
   * Resolves a provider asynchronously. For transient-scoped providers this creates a
   * fresh instance per call; for singletons it returns the already-resolved instance.
   */
  async resolve<T = unknown>(token: GraphTokenType, options: ModuleRefLookupOptions = {}): Promise<T> {
    const strict = options.strict ?? true;
    const node = this.graph.getNode(token);

    if (!node) {
      throw new DependencyUndefinedException(`Provider "${getTokenName(token)}" not found in the dependency graph.`);
    }

    if (strict && !this.#canAccess(token)) {
      throw new DependencyOutOfScopeException(
        `Provider "${getTokenName(token)}" is not accessible from "${getTokenName(this.ownerModule.token)}". ` +
          `Pass { strict: false } to bypass.`,
      );
    }

    return this.engine.resolveByToken<T>(node, this.ownerModule);
  }

  /**
   * Instantiates an arbitrary class with its constructor dependencies resolved from the
   * graph. The class does NOT need to be registered as a provider - useful for ad-hoc
   * service composition (e.g. a per-call worker built inside a handler).
   *
   * Dependencies are resolved from this `ModuleRef`'s owner module scope.
   */
  async create<T>(target: ConstructorType): Promise<T> {
    return this.engine.createInstance<T>(target, this.ownerModule);
  }

  /**
   * Returns a `ModuleRef` scoped to another module, making its own providers reachable even when
   * they are not exported to - and thus not visible from - the current scope.
   */
  select(module: ConstructorType): ModuleRef {
    const moduleNode = this.graph.findModuleNode(module);

    if (!moduleNode) {
      throw new DependencyUndefinedException(
        `Module "${getTokenName(module)}" is not a registered module - cannot select it.`,
      );
    }

    return new ModuleRef(this.graph, this.engine, moduleNode, this.scopeMaps);
  }

  /**
   * Resolves a token within a per-context `store` you provide - the mechanism behind contextual
   * (e.g. per-request) scope. `CONTEXTUAL`-scoped providers are instantiated fresh and cached in the
   * store (the whole per-context subtree shares it); non-contextual dependencies resolve as usual.
   * Seed the store with context objects (e.g. request/response) before calling. Intended for drivers
   * such as `@bytium-core/http`, one store per request.
   */
  async resolveContextual<T = unknown>(token: GraphTokenType, store: Map<GraphTokenType, unknown>): Promise<T> {
    return this.engine.resolveContextual<T>(token, store, this.ownerModule);
  }

  /**
   * Resolves and registers the interception pipeline (guards/pipes/interceptors/filters) for a controller
   * method, keyed by the controller class. For contextual (per-request) controllers that the eager pass
   * skips - a driver calls this once per route so the pipeline applies to every per-request instance.
   */
  async registerHandlerPipeline(controllerClass: ConstructorType, methodName: string): Promise<void> {
    return this.engine.registerControllerPipeline(controllerClass, methodName);
  }

  #canAccess(token: GraphTokenType): boolean {
    return isTokenVisible(token, this.ownerModule.token, this.scopeMaps);
  }
}
