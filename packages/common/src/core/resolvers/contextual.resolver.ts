import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { findOwnerModuleForToken } from "@core/utils/scope-lookup.utils";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { GraphTokenType } from "@core/types/graph-token.type";
import { instanceOfForwardRefDependency } from "@core/interfaces/forward-ref-dependency.interface";
import { ConstructorType, INQUIRER } from "@shared";
import { MODULE_REF_OWNER } from "@shared/consts/module-ref-owner.const";

export class ContextualResolver {
  constructor(
    private readonly graph: DependencyGraph,
    private readonly resolveDependency: (
      token: GraphTokenType,
      ownerModule: GraphNodeModel,
      requester: null,
    ) => Promise<unknown>,
  ) {}

  async resolveContextual<T = unknown>(
    token: GraphTokenType,
    store: Map<GraphTokenType, unknown>,
    fallbackOwnerModule: GraphNodeModel,
  ): Promise<T> {
    if (store.has(token)) return store.get(token) as T;

    const node = this.graph.getNode(token);

    if (
      !node ||
      node.scope !== BytiumProviderScopeEnum.CONTEXTUAL ||
      (node.type !== BytiumDependencyTypeEnum.PROVIDER && node.type !== BytiumDependencyTypeEnum.CONTROLLER)
    ) {
      return this.resolveDependency(token, fallbackOwnerModule, null) as Promise<T>;
    }

    const target = node.token as ConstructorType;
    const ownerModule = findOwnerModuleForToken(this.graph, token, fallbackOwnerModule) ?? fallbackOwnerModule;
    const params = node.metadata.constructorParams ?? [];
    const optionalParams = node.metadata.optionalParams ?? [];
    const args: unknown[] = [];

    for (let index = 0; index < params.length; index++) {
      args.push(await this.#resolveParamContextual(params[index], store, ownerModule, optionalParams.includes(index)));
    }

    const instance = new target(...args);

    store.set(token, instance);

    return instance as T;
  }

  async #resolveParamContextual(
    param: GraphTokenType,
    store: Map<GraphTokenType, unknown>,
    ownerModule: GraphNodeModel,
    isOptional: boolean,
  ): Promise<unknown> {
    if (param === MODULE_REF_OWNER) return ownerModule;

    if (param === INQUIRER) return null;

    if (!param && isOptional) return undefined;

    const token = instanceOfForwardRefDependency(param) ? param.forwardRef() : param;

    try {
      return await this.resolveContextual(token, store, ownerModule);
    } catch (error) {
      if (isOptional) return undefined;

      throw error;
    }
  }
}
