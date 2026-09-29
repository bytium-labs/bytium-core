import { HttpMethodEnum } from "@http/enums/http-method.enum";
import { HttpMetadataKeyEnum } from "@http/enums/http-metadata-key.enum";
import { HttpRouteInterface } from "@http/interfaces/http-route.interface";
import { RouteOptions } from "@http/interfaces/route-options.interface";
import { normalizePath } from "@http/utils/normalize-path.util";

/** Builds a route-method decorator (`@Get`, `@Post`, ...) that stamps the route metadata for the given method. */
export function createRouteDecorator(
  method: HttpMethodEnum,
): (path?: string, options?: RouteOptions) => MethodDecorator {
  return (path = "", options = {}) =>
    (target, propertyKey) => {
      const route: HttpRouteInterface = { method, path: normalizePath(path), binary: options.binary ?? false };

      Reflect.defineMetadata(HttpMetadataKeyEnum.ROUTE, route, target, propertyKey);
    };
}
