import "reflect-metadata";
import { Reflector } from "@core";
import { AcePermissionGuard, RequireAce } from "@citizenfx";
import { AnyExecutionContext } from "@core/types/any-execution-context.type";
import { BytiumMetadataEnum, ConstructorType } from "@shared";

describe("AcePermissionGuard", () => {
  const buildContext = (provider: object, overrides: { type: string } & Record<string, unknown>): AnyExecutionContext =>
    ({ provider, methodName: "handle", ...overrides }) as AnyExecutionContext;

  it("should attach AcePermissionGuard and store the ace when @RequireAce is applied", () => {
    class DependentProviderA {
      @RequireAce("event.kick")
      handle() {}
    }

    const guards: ConstructorType[] = Reflect.getMetadata(
      BytiumMetadataEnum.GUARDS,
      DependentProviderA.prototype,
      "handle",
    );

    expect(guards).toContain(AcePermissionGuard);
  });

  it("should allow a handler that has no @RequireAce", () => {
    class DependentProviderA {
      handle() {}
    }

    const acePermissionGuard = new AcePermissionGuard(new Reflector());
    const dependentProviderAInstance = new DependentProviderA();

    expect(
      acePermissionGuard.canActivate(buildContext(dependentProviderAInstance, { type: "onNetEvent", source: 5 })),
    ).toBe(true);
  });

  it("should allow a @RequireAce handler when the player holds the ace permission", () => {
    global.IsPlayerAceAllowed = (() => true) as typeof IsPlayerAceAllowed;

    class DependentProviderA {
      @RequireAce("event.kick")
      handle() {}
    }

    const acePermissionGuard = new AcePermissionGuard(new Reflector());
    const dependentProviderAInstance = new DependentProviderA();

    expect(
      acePermissionGuard.canActivate(buildContext(dependentProviderAInstance, { type: "onNetEvent", source: 5 })),
    ).toBe(true);
  });

  it("should deny a @RequireAce handler when the player lacks the ace permission", () => {
    global.IsPlayerAceAllowed = (() => false) as typeof IsPlayerAceAllowed;

    class DependentProviderA {
      @RequireAce("event.kick")
      handle() {}
    }

    const acePermissionGuard = new AcePermissionGuard(new Reflector());
    const dependentProviderAInstance = new DependentProviderA();

    expect(
      acePermissionGuard.canActivate(buildContext(dependentProviderAInstance, { type: "onNetEvent", source: 5 })),
    ).toBe(false);
  });

  it("should throw when @RequireAce is used on a surface that carries no source", () => {
    global.IsPlayerAceAllowed = (() => true) as typeof IsPlayerAceAllowed;

    class DependentProviderA {
      @RequireAce("event.kick")
      handle() {}
    }

    const acePermissionGuard = new AcePermissionGuard(new Reflector());
    const dependentProviderAInstance = new DependentProviderA();

    expect(() => acePermissionGuard.canActivate(buildContext(dependentProviderAInstance, { type: "tick" }))).toThrow(
      /no source is present/,
    );
  });
});
