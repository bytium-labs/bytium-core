import { Inject } from "@bytium-core/common";
import { getEntityManagerToken } from "@database/utils/get-entity-manager-token.utils";

/**
 * Injects a named TypeORM `EntityManager`.
 *
 * @param dataSourceName Name of the data source to inject the manager for.
 */
export function InjectEntityManager(dataSourceName = "default"): ParameterDecorator {
  return Inject(getEntityManagerToken(dataSourceName));
}
