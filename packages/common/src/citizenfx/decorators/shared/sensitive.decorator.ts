import { SensitiveMaskType } from "@invocation/types/sensitive-mask.type";
import { BytiumMetadataEnum } from "@shared";

/**
 * Masks the parameter in handler args logging (`bytium-core:logHandlerArgs`): the whole value
 * as `[REDACTED]` when called bare, or only the listed dot-separated fields when paths are given.
 */
export function Sensitive(paths?: string[]): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) {
      return;
    }

    const masks: Record<number, SensitiveMaskType> =
      Reflect.getMetadata(BytiumMetadataEnum.SENSITIVE_PARAMS, target, propertyKey) ?? {};

    Reflect.defineMetadata(
      BytiumMetadataEnum.SENSITIVE_PARAMS,
      { ...masks, [parameterIndex]: paths?.length ? [...paths] : true },
      target,
      propertyKey,
    );
  };
}
