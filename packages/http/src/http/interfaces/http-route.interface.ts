import { HttpMethodEnum } from "@http/enums/http-method.enum";

export interface HttpRouteInterface {
  method: HttpMethodEnum;
  path: string;
  binary: boolean;
}
