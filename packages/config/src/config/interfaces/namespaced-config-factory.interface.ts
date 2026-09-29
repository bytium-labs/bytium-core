/**
 * A typed config loader produced by {@link registerAs}; its `.KEY` is the DI token for the namespaced config.
 */
export interface NamespacedConfigFactory<T extends Record<string, any> = Record<string, any>> {
  (): { [namespace: string]: T };
  KEY: symbol;
  namespace: string;
}
