/**
 * Controls how `TestingModule.get` looks up a token.
 */
export interface TestingModuleGetOptions {
  /**
   * When `true`, only providers visible from the root module's scope are returned; a token out of scope throws.
   *
   * @default false
   */
  strict?: boolean;
}
