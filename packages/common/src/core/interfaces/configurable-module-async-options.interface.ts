import { FactoryInjectToken } from "@core/types/factory-inject-token.type";

/**
 * Async counterpart of a configurable module's options - produced by a factory instead of passed literally.
 */
export interface ConfigurableModuleAsyncOptions<TOptions> {
  /** Produces the module options; may be async and may depend on injected providers. */
  useFactory: (...args: any[]) => TOptions | Promise<TOptions>;

  /** Providers passed to `useFactory`, in declaration order. */
  inject?: FactoryInjectToken[];
}
