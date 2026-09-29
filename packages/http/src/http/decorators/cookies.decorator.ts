import { createParamDecorator } from "@bytium-core/common/server";
import { assertHttpContext } from "@http/utils/assert-http-context.util";
import { parseCookies } from "@http/utils/parse-cookies.util";

/** A named request cookie, or all cookies when no name is given. */
export const Cookies = createParamDecorator((name: string | undefined, context) => {
  const { request } = assertHttpContext(context, "@Cookies()");
  const cookies = parseCookies(request.headers["cookie"]);

  return name ? cookies[name] : cookies;
});
