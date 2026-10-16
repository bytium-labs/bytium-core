import "reflect-metadata";
import { Sensitive } from "@citizenfx/decorators/shared/sensitive.decorator";
import { BytiumMetadataEnum } from "@shared";

describe("Sensitive decorator", () => {
  it("should record a whole-value mask for the decorated parameter positions", () => {
    class LoginCommand {
      login(_login: string, @Sensitive() _password: string, @Sensitive() _token: string) {}
    }

    const masks = Reflect.getMetadata(BytiumMetadataEnum.SENSITIVE_PARAMS, LoginCommand.prototype, "login");

    expect(masks).toEqual({ 1: true, 2: true });
  });

  it("should record the dot paths when the decorator lists fields", () => {
    class AccountController {
      create(@Sensitive(["password", "credentials.token"]) _dto: object) {}
    }

    expect(Reflect.getMetadata(BytiumMetadataEnum.SENSITIVE_PARAMS, AccountController.prototype, "create")).toEqual({
      0: ["password", "credentials.token"],
    });
  });

  it("should keep masks of separate methods independent", () => {
    class AccountController {
      create(@Sensitive() _password: string) {}

      rename(_name: string) {}
    }

    expect(Reflect.getMetadata(BytiumMetadataEnum.SENSITIVE_PARAMS, AccountController.prototype, "create")).toEqual({
      0: true,
    });

    expect(
      Reflect.getMetadata(BytiumMetadataEnum.SENSITIVE_PARAMS, AccountController.prototype, "rename"),
    ).toBeUndefined();
  });
});
