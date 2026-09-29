import { createParamDecorator } from "@bytium-core/common/server";
import { multipartCache } from "@multipart/multipart-cache";
import { httpRequestOf } from "@multipart/utils/http-request-of.util";

/** All uploaded files, or only those sent under `field` when a name is given. */
export const UploadedFiles = createParamDecorator((field: string | undefined, context) => {
  const request = httpRequestOf(context);
  const parsed = request && multipartCache.get(request);

  if (!parsed) return [];

  return field ? parsed.files.filter((file) => file.fieldName === field) : parsed.files;
});
