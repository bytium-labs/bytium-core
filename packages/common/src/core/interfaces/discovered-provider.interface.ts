import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { GraphTokenType } from "@core/types/graph-token.type";

/**
 * A resolved provider surfaced by {@link DiscoveryService.getProviders}.
 */
export interface DiscoveredProviderInterface {
  /** The live provider instance. */
  instance: object;

  /** The DI token the provider is registered under. */
  token: GraphTokenType;

  /** The provider's scope. */
  scope: BytiumProviderScopeEnum;
}
