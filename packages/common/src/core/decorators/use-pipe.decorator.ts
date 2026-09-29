import { BytiumMetadataEnum, ConstructorType } from "@shared";
import { appendEnhancerMetadata } from "@core/utils/append-enhancer-metadata.utils";

/**
 * Attaches pipes to a handler, or to every handler of a controller.
 */
export function UsePipe(...pipes: ConstructorType[]): ClassDecorator & MethodDecorator {
  return ((target: object, propertyKey?: string | symbol) => {
    appendEnhancerMetadata(BytiumMetadataEnum.PIPES, pipes, target, propertyKey);
  }) as ClassDecorator & MethodDecorator;
}
