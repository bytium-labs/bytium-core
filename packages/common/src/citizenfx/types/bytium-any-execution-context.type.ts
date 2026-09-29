import { BytiumClientExecutionContext } from "@citizenfx/types/bytium-client-execution-context.type";
import { BytiumServerExecutionContext } from "@citizenfx/types/bytium-server-execution-context.type";

/**
 * Every invocation-surface context, client and server combined.
 */
export type BytiumAnyExecutionContext = BytiumClientExecutionContext | BytiumServerExecutionContext;
