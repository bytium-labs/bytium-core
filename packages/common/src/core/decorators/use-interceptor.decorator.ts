import { BytiumMetadataEnum, ConstructorType } from "@shared";
import { appendEnhancerMetadata } from "@core/utils/append-enhancer-metadata.utils";

/**
 * Attaches interceptors to a handler, or to every handler of a controller.
 */
export function UseInterceptor(...interceptors: ConstructorType[]): ClassDecorator & MethodDecorator {
  return ((target: object, propertyKey?: string | symbol) => {
    appendEnhancerMetadata(BytiumMetadataEnum.INTERCEPTORS, interceptors, target, propertyKey);
  }) as ClassDecorator & MethodDecorator;
}
