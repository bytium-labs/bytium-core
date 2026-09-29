import { BytiumMethodTypeEnum } from "@shared/enums/bytium-method-type.enum";

export const REQUEST_LIKE_METHOD_TYPES: ReadonlySet<BytiumMethodTypeEnum> = new Set([
  BytiumMethodTypeEnum.COMMAND,
  BytiumMethodTypeEnum.ON_NET_EVENT,
  BytiumMethodTypeEnum.NET_CALLBACK,
  BytiumMethodTypeEnum.CALLBACK,
  BytiumMethodTypeEnum.KEY_BIND,
  BytiumMethodTypeEnum.NUI_CALLBACK,
]);
