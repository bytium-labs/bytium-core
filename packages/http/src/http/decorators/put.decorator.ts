import { HttpMethodEnum } from "@http/enums/http-method.enum";
import { createRouteDecorator } from "@http/utils/create-route-decorator.util";

/**
 * Registers a `PUT` route handler.
 *
 * @param path Route path, relative to the controller prefix.
 * @param options Route options.
 */
export const Put = createRouteDecorator(HttpMethodEnum.PUT);
