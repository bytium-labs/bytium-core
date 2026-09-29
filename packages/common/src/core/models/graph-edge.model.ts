import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { ConstructorType } from "@shared";

export class GraphEdgeModel {
  readonly type: GraphEdgeTypeEnum;
  readonly target: ConstructorType | string | symbol;

  constructor(type: GraphEdgeTypeEnum, target: ConstructorType | string | symbol) {
    this.type = type;
    this.target = target;
  }
}
