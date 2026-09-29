import { createParamDecorator } from "@bytium-core/common/server";
import { assertHttpContext } from "@http/utils/assert-http-context.util";

/** The raw {@link HttpResponse}. */
export const Res = createParamDecorator((_data, context) => assertHttpContext(context, "@Res()").response);
