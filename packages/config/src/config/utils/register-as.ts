import { NamespacedConfigFactory } from "@config/interfaces/namespaced-config-factory.interface";

/**
 * Wraps a config loader so its returned object is nested under a namespace key.
 *
 * @example
 * ```ts
 * const databaseConfig = registerAs("database", () => ({ host: GetConvar("db_host", "localhost") }));
 * // configService.get("database.host")  - through the global ConfigService
 * // @Inject(databaseConfig.KEY) cfg: ConfigType<typeof databaseConfig>  - typed direct injection
 * ```
 */
export function registerAs<T extends Record<string, any>>(
  namespace: string,
  loader: () => T,
): NamespacedConfigFactory<T> {
  const factory = (() => ({ [namespace]: loader() })) as NamespacedConfigFactory<T>;

  factory.KEY = Symbol.for(`bytium:config:${namespace}`);
  factory.namespace = namespace;

  return factory;
}
