import { DependencyGraph } from "@core/graphs/dependency.graph";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { ScopeMapsInterface } from "@core/interfaces/scope-maps.interface";
import { ConstructorType } from "@shared";

export class ScopeMapsBuilder {
  static build(graph: DependencyGraph): ScopeMapsInterface {
    const maps: ScopeMapsInterface = {
      moduleProviders: new Map(),
      moduleExports: new Map(),
      moduleImports: new Map(),
      globalProviders: new Set(),
      resourceExternalImports: new Map(),
      providerOwnerModules: new Map(),
      moduleOwnerResource: new Map(),
    };

    this.#buildOwnershipMaps(graph, maps);

    for (const node of graph.getAllNodes()) {
      switch (node.type) {
        case BytiumDependencyTypeEnum.RESOURCE:
          this.#processResourceNode(node, maps);
          break;

        case BytiumDependencyTypeEnum.MODULE:
          this.#processModuleNode(node, graph, maps);
          break;
      }
    }

    return maps;
  }

  static #buildOwnershipMaps(graph: DependencyGraph, maps: ScopeMapsInterface): void {
    for (const node of graph.getAllNodes()) {
      if (node.type === BytiumDependencyTypeEnum.RESOURCE) {
        for (const module of node.getEdgeTargets(GraphEdgeTypeEnum.CONTAINS)) {
          maps.moduleOwnerResource.set(module, node.token);
        }

        continue;
      }

      if (node.type !== BytiumDependencyTypeEnum.MODULE) continue;

      for (const contained of node.getEdgeTargets(GraphEdgeTypeEnum.CONTAINS)) {
        const containedNode = graph.getNode(contained);

        if (
          containedNode?.type === BytiumDependencyTypeEnum.PROVIDER ||
          containedNode?.type === BytiumDependencyTypeEnum.CONTROLLER ||
          containedNode?.type === BytiumDependencyTypeEnum.CUSTOM_PROVIDER
        ) {
          const owners = maps.providerOwnerModules.get(contained) ?? new Set<ConstructorType | string | symbol>();

          owners.add(node.token);
          maps.providerOwnerModules.set(contained, owners);
        }
      }
    }
  }

  static #processResourceNode(node: GraphNodeModel, maps: ScopeMapsInterface): void {
    const externalImports = new Set<string>();

    for (const target of node.getEdgeTargets(GraphEdgeTypeEnum.IMPORTS)) {
      if (typeof target === "string") {
        externalImports.add(target);
      }
    }

    maps.resourceExternalImports.set(node.token, externalImports);
  }

  static #processModuleNode(node: GraphNodeModel, graph: DependencyGraph, maps: ScopeMapsInterface): void {
    const providers = new Set<ConstructorType | string | symbol>();

    for (const contained of node.getEdgeTargets(GraphEdgeTypeEnum.CONTAINS)) {
      const containedNode = graph.getNode(contained);

      if (
        containedNode?.type === BytiumDependencyTypeEnum.PROVIDER ||
        containedNode?.type === BytiumDependencyTypeEnum.CUSTOM_PROVIDER ||
        containedNode?.type === BytiumDependencyTypeEnum.MULTI_PROVIDER ||
        containedNode?.type === BytiumDependencyTypeEnum.EXTERNAL_PROVIDER
      ) {
        providers.add(contained);
      }
    }

    maps.moduleProviders.set(node.token, providers);
    maps.moduleExports.set(node.token, this.#collectExports(graph, node, new Set()));
    maps.moduleImports.set(node.token, node.getEdgeTargets(GraphEdgeTypeEnum.IMPORTS));

    if (node.metadata.isGlobal) {
      for (const exported of maps.moduleExports.get(node.token) ?? []) {
        maps.globalProviders.add(exported);
      }
    }
  }

  static #collectExports(
    graph: DependencyGraph,
    moduleNode: GraphNodeModel,
    visited: Set<ConstructorType | string | symbol>,
  ): Set<ConstructorType | string | symbol> {
    const result = new Set<ConstructorType | string | symbol>();

    for (const exported of moduleNode.getEdgeTargets(GraphEdgeTypeEnum.EXPORTS)) {
      const exportedNode = graph.getNode(exported);

      if (exportedNode?.type !== BytiumDependencyTypeEnum.MODULE) {
        result.add(exported);

        continue;
      }

      if (visited.has(exported)) continue;

      visited.add(exported);

      for (const token of this.#collectExports(graph, exportedNode, visited)) {
        result.add(token);
      }
    }

    return result;
  }
}
