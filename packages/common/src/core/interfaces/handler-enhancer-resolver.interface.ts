import { GraphTokenType } from "@core/types/graph-token.type";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { InstanceEntryModel } from "@core/models/instance-entry.model";
import { ConstructorType } from "@shared";

export interface HandlerEnhancerResolver {
  resolveDependency(
    token: GraphTokenType,
    ownerModule: GraphNodeModel,
    requester: InstanceEntryModel | null,
  ): Promise<unknown>;
  createInstance<T>(target: ConstructorType, ownerModule: GraphNodeModel): Promise<T>;
}
