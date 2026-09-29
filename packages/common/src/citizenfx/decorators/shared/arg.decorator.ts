import { createParamDecorator } from "@core/utils/create-param-decorator.utils";
import { BytiumAnyExecutionContext } from "@citizenfx/types/bytium-any-execution-context.type";

/**
 * Binds a single incoming argument (by index) to a handler parameter.
 */
export const Arg = createParamDecorator((index, context: BytiumAnyExecutionContext) => {
  if (!("args" in context)) {
    throw new Error(`@Arg() is not available in "${context.type}" handlers - no args are present.`);
  }

  return context.args[index as number];
});
