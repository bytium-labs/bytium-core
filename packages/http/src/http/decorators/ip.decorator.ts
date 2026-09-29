import { createParamDecorator } from "@bytium-core/common/server";
import { assertHttpContext } from "@http/utils/assert-http-context.util";

/** The sender's IP address. */
export const Ip = createParamDecorator((_data, context) => assertHttpContext(context, "@Ip()").request.address);
