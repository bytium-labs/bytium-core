import { HttpMethodEnum } from "@http/enums/http-method.enum";
import { createRouteDecorator } from "@http/utils/create-route-decorator.util";

/**
 * Registers a `POST` route handler.
 *
 * @param path Route path, relative to the controller prefix.
 * @param options Route options.
 */
export const Post = createRouteDecorator(HttpMethodEnum.POST);
