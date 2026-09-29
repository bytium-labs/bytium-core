import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { GraphTokenType } from "@core/types/graph-token.type";

/**
 * A resolved controller surfaced by {@link DiscoveryService.getControllers}.
 */
export interface DiscoveredControllerInterface {
  /** The live controller instance. */
  instance: object;

  /** The DI token the controller is registered under. */
  token: GraphTokenType;

  /** The controller's scope. */
  scope: BytiumProviderScopeEnum;
}
