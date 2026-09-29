import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { GraphTokenType } from "@core/types/graph-token.type";
import { unwrapToken } from "@core/utils/unwrap-token.utils";
import { ConstructorType, INQUIRER } from "@shared";

export class CircularDependencyResolver {
  readonly #placeholderTargets = new WeakMap<object, { current: object }>();

  constructor(private readonly graph: DependencyGraph) {}

  needs(node: GraphNodeModel): boolean {
    if ((node.metadata.forwardRefParams ?? []).length > 0) return true;

    const constructorParams = node.metadata.constructorParams ?? [];
    const hasTransientInquirerDep = constructorParams.some((param) => {
      const token = unwrapToken(param as ConstructorType | string | symbol);

      if (!token) return false;

      const paramNode = this.graph.getNode(token);

      if (paramNode?.scope !== BytiumProviderScopeEnum.TRANSIENT) return false;

      return (paramNode.metadata.constructorParams ?? []).includes(INQUIRER);
    });

    if (hasTransientInquirerDep) return true;

    return this.isInDependencyCycle(node);
  }

  /**
   * Stable reference handed to dependents before a cyclically-constructed provider exists. It is a
   * Proxy over a swappable target - a bare skeleton until `patch`, the real instance afterwards -
   * that binds method calls to the current target, so native `#private` fields resolve against the
   * real object instead of the placeholder.
   */
  create(target: ConstructorType): Record<string, unknown> {
    const holder = { current: Object.create(target.prototype) as object };
    const proxy = new Proxy(holder.current, {
      get: (_skeleton, property) => {
        const real = holder.current;
        const value = Reflect.get(real, property, real);

        if (
          typeof value !== "function" ||
          property === "constructor" ||
          Object.prototype.hasOwnProperty.call(real, property)
        ) {
          return value;
        }

        return value.bind(real);
      },
      set: (_skeleton, property, value) => Reflect.set(holder.current, property, value),
      has: (_skeleton, property) => Reflect.has(holder.current, property),
      deleteProperty: (_skeleton, property) => Reflect.deleteProperty(holder.current, property),
    });

    this.#placeholderTargets.set(proxy, holder);

    return proxy as Record<string, unknown>;
  }

  patch(placeholder: Record<string, unknown>, instance: object): void {
    const holder = this.#placeholderTargets.get(placeholder);

    if (holder) {
      holder.current = instance;

      return;
    }

    Object.assign(placeholder, instance);
  }

  isInDependencyCycle(node: GraphNodeModel): boolean {
    for (const targetToken of node.getEdgeTargets(GraphEdgeTypeEnum.DEPENDENCY)) {
      const next = this.graph.getNode(targetToken);

      if (next && this.hasDependencyPathTo(next, node)) {
        return true;
      }
    }

    return false;
  }

  hasDependencyPathTo(from: GraphNodeModel, to: GraphNodeModel, visited: Set<GraphTokenType> = new Set()): boolean {
    if (from === to) return true;

    if (visited.has(from.token)) return false;

    visited.add(from.token);

    for (const targetToken of from.getEdgeTargets(GraphEdgeTypeEnum.DEPENDENCY)) {
      const next = this.graph.getNode(targetToken);

      if (next && this.hasDependencyPathTo(next, to, visited)) {
        return true;
      }
    }

    return false;
  }
}
