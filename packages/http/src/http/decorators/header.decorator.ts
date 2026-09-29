import { HttpMetadataKeyEnum } from "@http/enums/http-metadata-key.enum";

/** Adds a static response header to every response from the handler. */
export function Header(key: string, value: string): MethodDecorator {
  return (target, propertyKey) => {
    const headers = (Reflect.getMetadata(HttpMetadataKeyEnum.HEADERS, target, propertyKey) ?? {}) as Record<
      string,
      string
    >;

    Reflect.defineMetadata(HttpMetadataKeyEnum.HEADERS, { ...headers, [key]: value }, target, propertyKey);
  };
}
