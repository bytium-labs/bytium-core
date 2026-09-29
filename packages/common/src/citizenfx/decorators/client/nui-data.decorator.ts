import { createParamDecorator } from "@core/utils/create-param-decorator.utils";
import { BytiumClientExecutionContext } from "@citizenfx/types/bytium-client-execution-context.type";

/**
 * Binds the payload sent from the NUI frontend to a `@NUICallback` handler parameter.
 */
export const NuiData = createParamDecorator((_data, context: BytiumClientExecutionContext) => {
  if (context.type !== "NUI_CALLBACK") {
    throw new Error(`@NuiData() is only available in @NUICallback handlers, not "${context.type}".`);
  }

  return context.data;
});
