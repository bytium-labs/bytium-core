import { BytiumMetadataEnum, ConstructorType } from "@shared";
import { appendEnhancerMetadata } from "@core/utils/append-enhancer-metadata.utils";

/**
 * Attaches exception filters to a handler, or to every handler of a controller.
 */
export function UseFilter(...filters: ConstructorType[]): ClassDecorator & MethodDecorator {
  return ((target: object, propertyKey?: string | symbol) => {
    appendEnhancerMetadata(BytiumMetadataEnum.FILTERS, filters, target, propertyKey);
  }) as ClassDecorator & MethodDecorator;
}
