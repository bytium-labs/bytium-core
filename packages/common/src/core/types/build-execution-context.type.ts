import { BytiumExecutionContextBase } from "@core/interfaces/bytium-execution-context-base.interface";

/**
 * Turns an execution-context map (`type` name to payload) into a discriminated union, with the base
 * fields mixed into every member.
 */
export type BuildExecutionContext<TMap> = {
  [K in keyof TMap]: BytiumExecutionContextBase & { type: K } & TMap[K];
}[keyof TMap];
