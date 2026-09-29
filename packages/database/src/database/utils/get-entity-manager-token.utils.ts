/**
 * Returns the DI token string for registering and resolving a named `EntityManager`.
 */
export function getEntityManagerToken(dataSourceName = "default"): string {
  return `EntityManager_${dataSourceName}`;
}
