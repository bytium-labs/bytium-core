import { DependencyGraph } from "@core/graphs/dependency.graph";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { InstanceEntryModel } from "@core/models/instance-entry.model";
import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ScopeMapsInterface } from "@core/interfaces/scope-maps.interface";

export function isTokenVisible(token: GraphTokenType, moduleToken: GraphTokenType, maps: ScopeMapsInterface): boolean {
  if (maps.globalProviders.has(token)) return true;

  if (maps.moduleProviders.get(moduleToken)?.has(token)) return true;

  for (const importedToken of maps.moduleImports.get(moduleToken) ?? []) {
    if (maps.moduleExports.get(importedToken)?.has(token)) return true;
  }

  return false;
}

function moduleExportsToken(
  graph: DependencyGraph,
  module: GraphNodeModel,
  token: GraphTokenType,
  visited: Set<GraphTokenType>,
): boolean {
  for (const exported of module.getEdgeTargets(GraphEdgeTypeEnum.EXPORTS)) {
    if (exported === token) return true;

    const exportedNode = graph.getNode(exported);

    if (exportedNode?.type !== BytiumDependencyTypeEnum.MODULE || visited.has(exported)) continue;

    visited.add(exported);

    if (moduleExportsToken(graph, exportedNode, token, visited)) return true;
  }

  return false;
}

export function resolveVisibleInstance(
  graph: DependencyGraph,
  token: GraphTokenType,
  requestingModule: GraphNodeModel,
  visited: Set<GraphTokenType> = new Set(),
): InstanceEntryModel | undefined {
  const node = graph.getNode(token);

  if (!node || node.instances.length === 0) return undefined;

  const own = node.instances.find((entry) => entry.ownerModule === requestingModule);

  if (own) return own;

  const globalInstance = node.instances.find((entry) => {
    const owner = entry.ownerModule;

    return owner != null && owner.metadata.isGlobal && moduleExportsToken(graph, owner, token, new Set());
  });

  if (globalInstance) return globalInstance;

  for (const importToken of requestingModule.getEdgeTargets(GraphEdgeTypeEnum.IMPORTS)) {
    if (visited.has(importToken)) continue;

    const importedModule = graph.getNode(importToken);

    if (!importedModule || importedModule.type !== BytiumDependencyTypeEnum.MODULE) continue;

    if (!moduleExportsToken(graph, importedModule, token, new Set())) continue;

    visited.add(importToken);

    const found = resolveVisibleInstance(graph, token, importedModule, visited);

    if (found) return found;
  }

  return undefined;
}

export function findOwnerModuleForToken(
  graph: DependencyGraph,
  token: GraphTokenType,
  requestingModule: GraphNodeModel,
  visited: Set<GraphTokenType> = new Set(),
): GraphNodeModel | undefined {
  if (requestingModule.getEdgeTargets(GraphEdgeTypeEnum.CONTAINS).includes(token)) {
    return requestingModule;
  }

  if (graph.getScopeMaps()?.globalProviders.has(token)) {
    const globalOwner = graph.getNode(token)?.owner;

    if (globalOwner) return globalOwner;
  }

  for (const importToken of requestingModule.getEdgeTargets(GraphEdgeTypeEnum.IMPORTS)) {
    if (visited.has(importToken)) continue;

    const importedModule = graph.getNode(importToken);

    if (!importedModule || importedModule.type !== BytiumDependencyTypeEnum.MODULE) continue;

    if (!moduleExportsToken(graph, importedModule, token, new Set())) continue;

    visited.add(importToken);

    const owner = findOwnerModuleForToken(graph, token, importedModule, visited);

    if (owner) return owner;
  }

  return undefined;
}
