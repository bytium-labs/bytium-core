import { BuildExecutionContext } from "@core/types/build-execution-context.type";
import { BytiumSharedExecutionContextMap } from "@citizenfx/interfaces/bytium-shared-execution-context-map.interface";
import { BytiumServerExecutionContextMap } from "@citizenfx/interfaces/bytium-server-execution-context-map.interface";

/**
 * Discriminated union of every invocation-surface context available on the server - shared surfaces plus server-only ones.
 */
export type BytiumServerExecutionContext = BuildExecutionContext<
  BytiumSharedExecutionContextMap & BytiumServerExecutionContextMap
>;
