import { createParamDecorator } from "@bytium-core/common/server";
import { multipartCache } from "@multipart/multipart-cache";
import { httpRequestOf } from "@multipart/utils/http-request-of.util";

/** A named text field from a `multipart/form-data` body. */
export const Field = createParamDecorator((name: string, context) => {
  const request = httpRequestOf(context);
  const parsed = request && multipartCache.get(request);

  return parsed?.fields[name];
});
