import { createParamDecorator } from "@bytium-core/common/server";
import { assertHttpContext } from "@http/utils/assert-http-context.util";

/** A named query-string value, or all query values when no name is given. */
export const Query = createParamDecorator((name: string | undefined, context) => {
  const { request } = assertHttpContext(context, "@Query()");

  return name ? request.query[name] : request.query;
});
