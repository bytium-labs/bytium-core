import { createParamDecorator } from "@core/utils/create-param-decorator.utils";
import { BytiumAnyExecutionContext } from "@citizenfx/types/bytium-any-execution-context.type";

/**
 * Binds the source of the invocation exactly as FiveM provided it: a number for a player or the server console, and
 * a string such as `"script"` when no player is behind it. Prefer `@Source()`, which always gives a string.
 */
export const RawSource = createParamDecorator((_data, context: BytiumAnyExecutionContext) => {
  if (!("rawSource" in context)) {
    throw new Error(`@RawSource() is not available in "${context.type}" handlers - no source is present.`);
  }

  return context.rawSource;
});
