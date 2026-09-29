import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { GraphNodeOriginEnum } from "@core/enums/graph-node-origin.enum";
import { GraphNodeMetadataInterface } from "@core/interfaces/graph-node-metadata.interface";
import { GraphEdgeModel } from "@core/models/graph-edge.model";
import { InstanceEntryModel } from "@core/models/instance-entry.model";
import { ConstructorType } from "@shared";

export class GraphNodeModel {
  readonly token: ConstructorType | string | symbol;
  readonly type: BytiumDependencyTypeEnum;
  scope?: BytiumProviderScopeEnum;
  owner: GraphNodeModel | null;
  readonly metadata: GraphNodeMetadataInterface;
  readonly edges: GraphEdgeModel[];
  readonly instances: InstanceEntryModel[];
  readonly origin: GraphNodeOriginEnum;

  constructor(
    token: ConstructorType | string | symbol,
    type: BytiumDependencyTypeEnum,
    origin: GraphNodeOriginEnum,
    metadata: GraphNodeMetadataInterface = {},
    owner: GraphNodeModel | null = null,
    scope?: BytiumProviderScopeEnum,
  ) {
    this.token = token;
    this.type = type;
    this.origin = origin;
    this.metadata = metadata;
    this.owner = owner;
    this.scope = scope;
    this.edges = [];
    this.instances = [];
  }

  getEdgeTargets(type: GraphEdgeTypeEnum): (ConstructorType | string | symbol)[] {
    return this.edges.filter((edge) => edge.type === type).map((edge) => edge.target);
  }
}
