import { ConstructorType } from "@bytium-core/common";

/**
 * Options for `HttpModule.forRoot`.
 */
export interface HttpModuleOptions {
  /** Transport-level middleware classes, run in order before routing. Resolved through DI. */
  middleware?: ConstructorType[];
}
