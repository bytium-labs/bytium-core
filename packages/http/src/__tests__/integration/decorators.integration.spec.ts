import "reflect-metadata";
import { BytiumMetadataEnum, BytiumProviderScopeEnum } from "@bytium-core/common";
import { Get, HttpController, HttpMethodEnum } from "@http";
import { HttpMetadataKeyEnum } from "@http/enums/http-metadata-key.enum";

describe("HTTP decorators", () => {
  it("should mark an @HttpController as a contextual-scoped controller with its prefix", () => {
    @HttpController("/admin")
    class ControllerA {}

    const dependencyType = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_TYPE, ControllerA);
    const dependencyScope = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_SCOPE, ControllerA);
    const prefix = Reflect.getMetadata(HttpMetadataKeyEnum.CONTROLLER_PREFIX, ControllerA);

    expect(dependencyType).toBe("CONTROLLER");
    expect(dependencyScope).toBe(BytiumProviderScopeEnum.CONTEXTUAL);
    expect(prefix).toBe("/admin");
  });

  it("should default an @HttpController prefix to empty when none is given", () => {
    @HttpController()
    class ControllerA {}

    expect(Reflect.getMetadata(HttpMetadataKeyEnum.CONTROLLER_PREFIX, ControllerA)).toBe("");
  });

  it("should stamp method and normalized path on a route method", () => {
    class ControllerA {
      @Get("users")
      handle() {}
    }

    const route = Reflect.getMetadata(HttpMetadataKeyEnum.ROUTE, ControllerA.prototype, "handle");

    expect(route).toEqual({ method: HttpMethodEnum.GET, path: "/users", binary: false });
  });
});
