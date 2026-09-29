import { createParamDecorator } from "@core/utils/create-param-decorator.utils";
import { BytiumAnyExecutionContext } from "@citizenfx/types/bytium-any-execution-context.type";

/**
 * Binds the incoming argument list to a handler parameter.
 */
export const Args = createParamDecorator((_data, context: BytiumAnyExecutionContext) => {
  if (!("args" in context)) {
    throw new Error(`@Args() is not available in "${context.type}" handlers - no args are present.`);
  }

  return context.args;
});
