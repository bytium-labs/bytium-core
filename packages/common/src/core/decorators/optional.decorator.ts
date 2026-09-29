import { BytiumMetadataEnum, ConstructorType } from "@shared";

/**
 * Marks a constructor parameter or injected property as optional; an unresolved dependency is injected as `undefined`.
 */
export function Optional(): ParameterDecorator & PropertyDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex?: number) => {
    if (typeof parameterIndex === "number") {
      const indices: number[] = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONAL_PARAMS, target) ?? [];

      if (!indices.includes(parameterIndex)) {
        indices.push(parameterIndex);
        Reflect.defineMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONAL_PARAMS, indices, target);
      }

      return;
    }

    if (propertyKey === undefined) return;

    const constructor = (target as { constructor: ConstructorType }).constructor;
    const keys: (string | symbol)[] =
      Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONAL_PROPERTIES, constructor) ?? [];

    if (!keys.includes(propertyKey)) {
      keys.push(propertyKey);
      Reflect.defineMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONAL_PROPERTIES, keys, constructor);
    }
  };
}
