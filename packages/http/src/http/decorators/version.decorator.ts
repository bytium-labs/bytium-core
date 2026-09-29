import { HttpMetadataKeyEnum } from "@http/enums/http-metadata-key.enum";

/**
 * Tags a route (or a whole controller) with an API version matched against the `X-API-Version` header.
 */
export function Version(version: string): MethodDecorator & ClassDecorator {
  return ((target: object, propertyKey?: string | symbol) => {
    if (propertyKey === undefined) {
      Reflect.defineMetadata(HttpMetadataKeyEnum.VERSION, version, target);

      return;
    }

    Reflect.defineMetadata(HttpMetadataKeyEnum.VERSION, version, target, propertyKey);
  }) as MethodDecorator & ClassDecorator;
}
