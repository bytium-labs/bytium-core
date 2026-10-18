import { createParamDecorator } from "@core/utils/create-param-decorator.utils";
import { BytiumAnyExecutionContext } from "@citizenfx/types/bytium-any-execution-context.type";

/**
 * Binds the source of the invocation to a handler parameter, always as a string: `"12"` for a player, `"0"` for the
 * server console, and whatever FiveM reports when no player is behind it, such as `"script"` for a plain `emit` on
 * FiveM for GTA V Enhanced (`""` elsewhere). Use `@RawSource()` for the value exactly as FiveM provided it.
 */
export const Source = createParamDecorator((_data, context: BytiumAnyExecutionContext) => {
  if (!("source" in context)) {
    throw new Error(`@Source() is not available in "${context.type}" handlers - no source is present.`);
  }

  return context.source;
});
