import { BytiumMetadataEnum } from "@shared";
import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";

/**
 * Marks a class as a controller - a resource entrypoint that holds handlers such as `@Command`, `@OnNetEvent`, and `@Callback`.
 */
export function Controller(): ClassDecorator {
  return function (constructor) {
    Reflect.defineMetadata(BytiumMetadataEnum.DEPENDENCY_TYPE, BytiumDependencyTypeEnum.CONTROLLER, constructor);
  };
}
