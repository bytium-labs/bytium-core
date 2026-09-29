import { createParamDecorator } from "@bytium-core/common/server";
import { assertHttpContext } from "@http/utils/assert-http-context.util";

/** A named request header, or all headers when no name is given. */
export const Headers = createParamDecorator((name: string | undefined, context) => {
  const { request } = assertHttpContext(context, "@Headers()");

  return name ? request.headers[name.toLowerCase()] : request.headers;
});
