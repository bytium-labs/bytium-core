import { createParamDecorator } from "@bytium-core/common/server";
import { multipartCache } from "@multipart/multipart-cache";
import { httpRequestOf } from "@multipart/utils/http-request-of.util";

/** The first uploaded file, or the file sent under `field` when a name is given. */
export const UploadedFile = createParamDecorator((field: string | undefined, context) => {
  const request = httpRequestOf(context);
  const parsed = request && multipartCache.get(request);

  if (!parsed) return undefined;

  return field ? parsed.files.find((file) => file.fieldName === field) : parsed.files[0];
});
