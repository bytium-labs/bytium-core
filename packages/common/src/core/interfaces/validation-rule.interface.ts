import { GraphNodeModel } from "@core/models/graph-node.model";
import { ScopeMapsInterface } from "@core/interfaces/scope-maps.interface";

export interface ValidationRuleInterface {
  validate(nodes: GraphNodeModel[], scopeMaps: ScopeMapsInterface): void;
  getName(): string;
}
