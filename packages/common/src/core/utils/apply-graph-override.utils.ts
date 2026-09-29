import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { CustomProviderConfigType } from "@core/types/custom-provider-config.type";
import { GraphTokenType } from "@core/types/graph-token.type";
import { DependencyUndefinedException } from "@core/exceptions/dependency-undefined.exception";

export function applyGraphOverride(
  graph: DependencyGraph,
  token: GraphTokenType,
  override: CustomProviderConfigType,
): void {
  const node = graph.getNode(token);

  if (!node) {
    throw new DependencyUndefinedException(
      `Cannot override "${tokenName(token)}" - no matching provider in the graph. ` +
        `Check the token spelling and that the providing module is included in imports.`,
    );
  }

  if (node.type !== BytiumDependencyTypeEnum.CUSTOM_PROVIDER && node.type !== BytiumDependencyTypeEnum.PROVIDER) {
    return;
  }

  (node as { type: BytiumDependencyTypeEnum }).type = BytiumDependencyTypeEnum.CUSTOM_PROVIDER;

  node.metadata.customProvider = override;
  node.metadata.constructorParams = [];
  node.metadata.optionalParams = [];
  node.metadata.forwardRefParams = [];

  const overrideScope = (override as { scope?: BytiumProviderScopeEnum }).scope;

  if (overrideScope !== undefined) {
    node.scope = overrideScope;
  }

  for (let i = node.edges.length - 1; i >= 0; i--) {
    if (node.edges[i].type === GraphEdgeTypeEnum.DEPENDENCY) {
      node.edges.splice(i, 1);
    }
  }

  if ("useFactory" in override && override.inject) {
    for (const dep of override.inject) {
      const isOptionalRef =
        typeof dep === "object" &&
        dep !== null &&
        "optional" in dep &&
        (dep as { optional?: unknown }).optional === true;
      const target = isOptionalRef ? (dep as { token: GraphTokenType }).token : (dep as GraphTokenType);

      if (!isOptionalRef) {
        graph.addEdge(token, target, GraphEdgeTypeEnum.DEPENDENCY);
      }
    }
  }

  if ("useExisting" in override && override.useExisting) {
    graph.addEdge(token, override.useExisting, GraphEdgeTypeEnum.DEPENDENCY);
  }

  if ("useClass" in override && override.useClass) {
    graph.addEdge(token, override.useClass, GraphEdgeTypeEnum.DEPENDENCY);
  }
}

function tokenName(token: GraphTokenType): string {
  if (typeof token === "string") return token;

  if (typeof token === "symbol") return token.toString();

  return token.name;
}
