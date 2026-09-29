import { BytiumMetadataEnum, ConstructorType } from "@shared";
import { appendEnhancerMetadata } from "@core/utils/append-enhancer-metadata.utils";

/**
 * Attaches guards to a handler, or to every handler of a controller.
 */
export function UseGuard(...guards: ConstructorType[]): ClassDecorator & MethodDecorator {
  return ((target: object, propertyKey?: string | symbol) => {
    appendEnhancerMetadata(BytiumMetadataEnum.GUARDS, guards, target, propertyKey);
  }) as ClassDecorator & MethodDecorator;
}
