import { CanActivate } from "@core/interfaces/can-activate.interface";
import { Injectable } from "@core/decorators/injectable.decorator";
import { Reflector } from "@core/services/reflector.service";
import { AnyExecutionContext } from "@core/types/any-execution-context.type";
import { CitizenFXMetadataKeyEnum } from "@citizenfx/enums/citizenfx-metadata-key.enum";

/**
 * Enforces `@RequireAce(...)` against FiveM's ace permission system.
 */
@Injectable()
export class AcePermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: AnyExecutionContext): boolean {
    const ace = this.reflector.get<string>(
      CitizenFXMetadataKeyEnum.REQUIRE_ACE,
      Object.getPrototypeOf(context.provider),
      context.methodName,
    );

    if (!ace) return true;

    if (!("source" in context)) {
      throw new Error(`@RequireAce("${ace}") is not available in "${context.type}" handlers - no source is present.`);
    }

    const source = (context as typeof context & { source: number }).source;

    return IsPlayerAceAllowed(String(source), ace);
  }
}
