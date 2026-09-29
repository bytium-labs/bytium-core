import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { InstanceStateEnum } from "@core/enums/instance-state.enum";
import { CircularCheckResultInterface } from "@core/interfaces/circular-check-result.interface";
import { GraphEdgeModel } from "@core/models/graph-edge.model";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { InstanceEntryModel } from "@core/models/instance-entry.model";
import { GraphTokenType } from "@core/types/graph-token.type";
import { ScopeMapsInterface } from "@core/interfaces/scope-maps.interface";
import { getTokenName } from "@core/utils/token-name.utils";

export class DependencyGraph {
  readonly #nodes = new Map<GraphTokenType, GraphNodeModel>();
  readonly #resolvedInstances: InstanceEntryModel[] = [];
  #initOrderCounter = 0;
  #scopeMaps?: ScopeMapsInterface;

  addNode(node: GraphNodeModel): void {
    if (this.#nodes.has(node.token)) return;

    this.#nodes.set(node.token, node);
  }

  addEdge(from: GraphTokenType, to: GraphTokenType, type: GraphEdgeTypeEnum): void {
    const fromNode = this.#nodes.get(from);

    if (!fromNode) return;

    const exists = fromNode.edges.some((edge) => edge.type === type && edge.target === to);

    if (!exists) {
      fromNode.edges.push(new GraphEdgeModel(type, to));
    }

    if (type === GraphEdgeTypeEnum.CONTAINS) {
      const toNode = this.#nodes.get(to);

      if (toNode) {
        toNode.owner = fromNode;
      }
    }
  }

  getNode(token: GraphTokenType): GraphNodeModel | undefined {
    return this.#nodes.get(token);
  }

  findModuleNode(moduleClass: GraphTokenType): GraphNodeModel | undefined {
    const direct = this.#nodes.get(moduleClass);

    if (direct) return direct;

    for (const node of this.#nodes.values()) {
      if (node.metadata.moduleClass === moduleClass) return node;
    }

    return undefined;
  }

  getAllNodes(): GraphNodeModel[] {
    return Array.from(this.#nodes.values());
  }

  setScopeMaps(scopeMaps: ScopeMapsInterface): void {
    this.#scopeMaps = scopeMaps;
  }

  getScopeMaps(): ScopeMapsInterface | undefined {
    return this.#scopeMaps;
  }

  addInstance(node: GraphNodeModel, entry: InstanceEntryModel): void {
    node.instances.push(entry);
  }

  markResolved(entry: InstanceEntryModel): void {
    entry.state = InstanceStateEnum.RESOLVED;
    entry.initOrder = ++this.#initOrderCounter;
    this.#resolvedInstances.push(entry);
  }

  removeInstance(entry: InstanceEntryModel): void {
    const resolvedIndex = this.#resolvedInstances.indexOf(entry);

    if (resolvedIndex !== -1) {
      this.#resolvedInstances.splice(resolvedIndex, 1);
    }

    for (const node of this.#nodes.values()) {
      const index = node.instances.indexOf(entry);

      if (index !== -1) {
        node.instances.splice(index, 1);

        return;
      }
    }
  }

  getInstancesInInitOrder(): InstanceEntryModel[] {
    return [...this.#resolvedInstances];
  }

  hasCircular(edgeType: GraphEdgeTypeEnum = GraphEdgeTypeEnum.DEPENDENCY): CircularCheckResultInterface {
    const visited = new Set<GraphTokenType>();
    const stack = new Set<GraphTokenType>();
    const path: GraphTokenType[] = [];
    const dfs = (token: GraphTokenType): boolean => {
      visited.add(token);
      stack.add(token);
      path.push(token);

      const node = this.#nodes.get(token);

      if (node) {
        for (const edge of node.edges) {
          if (edge.type !== edgeType) continue;

          if (!visited.has(edge.target)) {
            if (dfs(edge.target)) return true;
          } else if (stack.has(edge.target)) {
            path.push(edge.target);

            return true;
          }
        }
      }

      stack.delete(token);
      path.pop();

      return false;
    };

    for (const token of this.#nodes.keys()) {
      if (visited.has(token)) continue;

      path.length = 0;

      if (dfs(token)) {
        return { hasCircular: true, cycle: path.map((token) => getTokenName(token)) };
      }
    }

    return { hasCircular: false };
  }

  clear(): void {
    this.#nodes.clear();
    this.#resolvedInstances.length = 0;
    this.#initOrderCounter = 0;
  }
}
