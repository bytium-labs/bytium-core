import { createParamDecorator } from "@core/utils/create-param-decorator.utils";
import { BytiumAnyExecutionContext } from "@citizenfx/types/bytium-any-execution-context.type";

/**
 * Binds the originating channel to an `@OnConsoleOutput` handler parameter.
 */
export const ConsoleChannel = createParamDecorator((_data, context: BytiumAnyExecutionContext) => {
  if (context.type !== "ON_CONSOLE_OUTPUT") {
    throw new Error(`@ConsoleChannel() is only available in @OnConsoleOutput handlers, not "${context.type}".`);
  }

  return context.channel;
});
