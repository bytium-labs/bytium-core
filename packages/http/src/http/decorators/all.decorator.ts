import { HttpMethodEnum } from "@http/enums/http-method.enum";
import { createRouteDecorator } from "@http/utils/create-route-decorator.util";

/**
 * Registers a route handler that matches a request of any method.
 *
 * @param path Route path, relative to the controller prefix.
 * @param options Route options.
 */
export const All = createRouteDecorator(HttpMethodEnum.ALL);
