import { createParamDecorator } from "@core/utils/create-param-decorator.utils";
import { BytiumAnyExecutionContext } from "@citizenfx/types/bytium-any-execution-context.type";

/**
 * Binds the changed convar's name to an `@OnConvarChange` handler parameter.
 */
export const ConvarName = createParamDecorator((_data, context: BytiumAnyExecutionContext) => {
  if (context.type !== "ON_CONVAR_CHANGE") {
    throw new Error(`@ConvarName() is only available in @OnConvarChange handlers, not "${context.type}".`);
  }

  return context.convarName;
});
