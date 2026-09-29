import type { EntityTarget } from "typeorm";
import { Inject } from "@bytium-core/common";
import { getRepositoryToken } from "@database/utils/get-repository-token.utils";

/**
 * Injects the TypeORM `Repository` for an entity.
 *
 * @param entity The entity to inject the repository for.
 * @param dataSourceName Name of the data source the repository belongs to.
 */
export function InjectRepository<Entity>(entity: EntityTarget<Entity>, dataSourceName = "default"): ParameterDecorator {
  return Inject(getRepositoryToken(entity, dataSourceName));
}
