import type { EntityTarget } from "typeorm";

/**
 * Returns the DI token string for registering and resolving a `Repository<Entity>` (optionally
 * scoped to a named connection).
 *
 * @example
 * ```ts
 * {
 *   provide: getRepositoryToken(User),
 *   useValue: mockUserRepository,
 * }
 * ```
 */
export function getRepositoryToken<Entity>(entity: EntityTarget<Entity>, dataSourceName = "default"): string {
  const entityName = typeof entity === "function" ? entity.name : String(entity);

  return dataSourceName === "default" ? `Repository_${entityName}` : `Repository_${dataSourceName}_${entityName}`;
}
