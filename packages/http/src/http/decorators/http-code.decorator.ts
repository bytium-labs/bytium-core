import { HttpMetadataKeyEnum } from "@http/enums/http-metadata-key.enum";

/** Sets the default status code sent when the handler resolves without setting one itself. */
export function HttpCode(code: number): MethodDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata(HttpMetadataKeyEnum.CODE, code, target, propertyKey);
  };
}
