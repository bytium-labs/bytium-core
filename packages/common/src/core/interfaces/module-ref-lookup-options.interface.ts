/**
 * Controls how `ModuleRef.get` / `resolve` looks up a token.
 */
export interface ModuleRefLookupOptions {
  /**
   * When `true`, only providers visible from the injecting module's scope are returned; when `false`, any token in the graph is returned.
   *
   * @default true
   */
  strict?: boolean;
}
