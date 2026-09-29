import { HttpMetadataKeyEnum } from "@http/enums/http-metadata-key.enum";
import { HttpRedirectInterface } from "@http/interfaces/http-redirect.interface";

/** Redirects the response to `url` (default status 302) instead of returning a body. */
export function Redirect(url: string, statusCode = 302): MethodDecorator {
  return (target, propertyKey) => {
    const redirect: HttpRedirectInterface = { url, statusCode };

    Reflect.defineMetadata(HttpMetadataKeyEnum.REDIRECT, redirect, target, propertyKey);
  };
}
