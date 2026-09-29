/**
 * Lifecycle scope controlling how a provider is instantiated.
 */
export enum BytiumProviderScopeEnum {
  /** One shared instance for the whole resource. */
  SINGLETON = "SINGLETON",

  /** A fresh instance created for every injection. */
  TRANSIENT = "TRANSIENT",

  /** One instance per external context, whose boundary is defined by a driver (e.g. one per HTTP request). */
  CONTEXTUAL = "CONTEXTUAL",
}
