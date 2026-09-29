import { ConstructorType } from "@shared";
import { GraphTokenType } from "@core/types/graph-token.type";

/**
 * A registered module surfaced by {@link DiscoveryService.getModules}.
 */
export interface DiscoveredModuleInterface {
  /** The DI token the module is registered under. */
  token: GraphTokenType;

  /** The defining module class - equal to `token` for static modules, resolved from metadata for per-instance dynamic modules; `undefined` when unavailable. */
  moduleClass: ConstructorType | undefined;
}
