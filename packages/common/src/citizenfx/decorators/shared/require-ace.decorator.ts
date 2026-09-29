import { BytiumMetadataEnum, ConstructorType } from "@shared";
import { AcePermissionGuard } from "@citizenfx/guards/ace-permission.guard";
import { CitizenFXMetadataKeyEnum } from "@citizenfx/enums/citizenfx-metadata-key.enum";

/**
 * Requires the triggering player to hold a FiveM ace permission for the handler to run.
 */
export const RequireAce =
  (ace: string): MethodDecorator =>
  (target, propertyKey) => {
    Reflect.defineMetadata(CitizenFXMetadataKeyEnum.REQUIRE_ACE, ace, target, propertyKey);

    const guards: ConstructorType[] = Reflect.getMetadata(BytiumMetadataEnum.GUARDS, target, propertyKey) ?? [];

    if (!guards.includes(AcePermissionGuard)) {
      Reflect.defineMetadata(BytiumMetadataEnum.GUARDS, [...guards, AcePermissionGuard], target, propertyKey);
    }
  };
