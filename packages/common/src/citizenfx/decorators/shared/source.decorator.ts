import { createParamDecorator } from "@core/utils/create-param-decorator.utils";
import { BytiumAnyExecutionContext } from "@citizenfx/types/bytium-any-execution-context.type";

/**
 * Binds the triggering player's server id to a handler parameter.
 */
export const Source = createParamDecorator((_data, context: BytiumAnyExecutionContext) => {
  if (!("source" in context)) {
    throw new Error(`@Source() is not available in "${context.type}" handlers - no source is present.`);
  }

  return context.source;
});
