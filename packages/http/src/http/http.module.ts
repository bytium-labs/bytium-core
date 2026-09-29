import { BytiumResourceDynamicModuleInterface, ConstructorType } from "@bytium-core/common";
import { HttpRouterService } from "@http/services/http-router.service";
import { HttpModuleOptions } from "@http/interfaces/http-module-options.interface";
import { HTTP_MIDDLEWARE } from "@http/consts/http-middleware.token";

/**
 * Registers the HTTP layer for a resource.
 */
export class HttpModule {
  /** Registers the HTTP module. Pass `middleware` to run before routing on every request. */
  static forRoot(options: HttpModuleOptions = {}): BytiumResourceDynamicModuleInterface {
    const middleware = options.middleware ?? [];

    return {
      module: HttpModule as ConstructorType,
      name: "httpRootModule",
      providers: [HttpRouterService, ...middleware, { provide: HTTP_MIDDLEWARE, useValue: middleware }],
    };
  }
}
