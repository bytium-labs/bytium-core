/**
 * Stamps an arbitrary metadata key/value onto a class, method or property.
 *
 * @example
 * ```ts
 * const PERM_KEY = Symbol("perm");
 * export const RequireAcePerm = (perm: string) => SetMetadata(PERM_KEY, perm);
 * ```
 */
export function SetMetadata<K = unknown, V = unknown>(
  metadataKey: K,
  metadataValue: V,
): ClassDecorator & MethodDecorator & PropertyDecorator {
  return (target: object, propertyKey?: string | symbol) => {
    if (propertyKey !== undefined) {
      Reflect.defineMetadata(metadataKey, metadataValue, target, propertyKey);

      return;
    }

    Reflect.defineMetadata(metadataKey, metadataValue, target);
  };
}
