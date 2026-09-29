import { createParamDecorator } from "@core/utils/create-param-decorator.utils";
import { BytiumAnyExecutionContext } from "@citizenfx/types/bytium-any-execution-context.type";

/**
 * Binds the raw, unparsed command string to a `@Command` handler parameter.
 */
export const RawCommand = createParamDecorator((_data, context: BytiumAnyExecutionContext) => {
  if (context.type !== "COMMAND") {
    throw new Error(`@RawCommand() is only available in @Command handlers, not "${context.type}".`);
  }

  return context.rawCommand;
});
