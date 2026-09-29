import { ConstructorType } from "@bytium-core/common";
import { HttpMethodEnum } from "@http/enums/http-method.enum";

export interface RouteEntryInterface {
  method: HttpMethodEnum;
  segments: string[];
  controllerToken: ConstructorType;
  methodName: string;
  binary: boolean;
  version?: string;
}
