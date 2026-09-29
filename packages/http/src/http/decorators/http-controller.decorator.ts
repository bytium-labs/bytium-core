import { BytiumMetadataEnum, BytiumProviderScopeEnum, Controller } from "@bytium-core/common";
import { HttpMetadataKeyEnum } from "@http/enums/http-metadata-key.enum";
import { normalizePath } from "@http/utils/normalize-path.util";

/**
 * Marks a class as an HTTP controller; `prefix` is prepended to every route's path.
 */
export function HttpController(prefix = ""): ClassDecorator {
  return (target) => {
    Controller()(target);

    Reflect.defineMetadata(BytiumMetadataEnum.DEPENDENCY_SCOPE, BytiumProviderScopeEnum.CONTEXTUAL, target);
    Reflect.defineMetadata(HttpMetadataKeyEnum.CONTROLLER_PREFIX, normalizePath(prefix), target);
  };
}
