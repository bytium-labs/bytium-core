import { BytiumMetadataEnum, ConstructorType } from "@shared";

export function appendEnhancerMetadata(
  metadataKey: BytiumMetadataEnum,
  items: ConstructorType[],
  target: object,
  propertyKey?: string | symbol,
): void {
  const existing: ConstructorType[] =
    (propertyKey === undefined
      ? Reflect.getMetadata(metadataKey, target)
      : Reflect.getMetadata(metadataKey, target, propertyKey)) ?? [];
  const next = [...existing, ...items];

  if (propertyKey === undefined) {
    Reflect.defineMetadata(metadataKey, next, target);

    return;
  }

  Reflect.defineMetadata(metadataKey, next, target, propertyKey);
}
