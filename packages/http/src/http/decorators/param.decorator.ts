import { createParamDecorator } from "@bytium-core/common/server";
import { assertHttpContext } from "@http/utils/assert-http-context.util";

/** A named path parameter, or all path parameters when no name is given. */
export const Param = createParamDecorator((name: string | undefined, context) => {
  const { request } = assertHttpContext(context, "@Param()");

  return name ? request.params[name] : request.params;
});
