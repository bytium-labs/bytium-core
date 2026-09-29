import { BytiumExecutionContextBase } from "@core/interfaces/bytium-execution-context-base.interface";

/**
 * The runtime-loose execution-context contract: the base fields plus a `type` discriminator.
 */
export type AnyExecutionContext = BytiumExecutionContextBase & { type: string };
