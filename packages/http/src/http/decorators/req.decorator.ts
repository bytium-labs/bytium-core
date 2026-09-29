import { createParamDecorator } from "@bytium-core/common/server";
import { assertHttpContext } from "@http/utils/assert-http-context.util";

/** The raw {@link HttpRequest}. */
export const Req = createParamDecorator((_data, context) => assertHttpContext(context, "@Req()").request);
