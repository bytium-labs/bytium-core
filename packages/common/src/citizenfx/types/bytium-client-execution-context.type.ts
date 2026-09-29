import { BuildExecutionContext } from "@core/types/build-execution-context.type";
import { BytiumSharedExecutionContextMap } from "@citizenfx/interfaces/bytium-shared-execution-context-map.interface";
import { BytiumClientExecutionContextMap } from "@citizenfx/interfaces/bytium-client-execution-context-map.interface";

/**
 * Discriminated union of every invocation-surface context available on the client - shared surfaces plus client-only ones.
 */
export type BytiumClientExecutionContext = BuildExecutionContext<
  BytiumSharedExecutionContextMap & BytiumClientExecutionContextMap
>;
