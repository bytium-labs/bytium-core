import { createParamDecorator } from "@core/utils/create-param-decorator.utils";
import { BytiumClientExecutionContext } from "@citizenfx/types/bytium-client-execution-context.type";

/**
 * Binds the key's state to a `@KeyBind` handler parameter.
 */
export const KeyState = createParamDecorator((_data, context: BytiumClientExecutionContext) => {
  if (context.type !== "KEY_BIND") {
    throw new Error(`@KeyState() is only available in @KeyBind handlers, not "${context.type}".`);
  }

  return context.state;
});
