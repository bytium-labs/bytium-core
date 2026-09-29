import { InstanceStateEnum } from "@core/enums/instance-state.enum";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { GraphNodeModel } from "@core/models/graph-node.model";

export class InstanceEntryModel {
  instance: unknown;
  state: InstanceStateEnum = InstanceStateEnum.RESOLVING;
  initOrder = -1;
  readonly scope: BytiumProviderScopeEnum;
  readonly ownerModule: GraphNodeModel | null;
  readonly caller: InstanceEntryModel | null;
  readonly isAlias: boolean;

  constructor(
    instance: unknown,
    scope: BytiumProviderScopeEnum,
    ownerModule: GraphNodeModel | null = null,
    caller: InstanceEntryModel | null = null,
    isAlias = false,
  ) {
    this.instance = instance;
    this.scope = scope;
    this.ownerModule = ownerModule;
    this.caller = caller;
    this.isAlias = isAlias;
  }
}
