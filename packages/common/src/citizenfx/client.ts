export * from "@citizenfx";

export { Command, CommandOptions } from "@citizenfx/decorators/client/command.decorator";
export { NetCallback, NetCallbackOptions } from "@citizenfx/decorators/client/net-callback.decorator";
export { OnNetEvent, OnNetEventOptions } from "@citizenfx/decorators/client/on-net-event.decorator";
export { KeyBind, KeyBindOptions } from "@citizenfx/decorators/client/key-bind.decorator";
export { NUICallback, NUICallbackOptions } from "@citizenfx/decorators/client/nui-callback.decorator";
export {
  OnClientResourceStart,
  OnClientResourceStartOptions,
} from "@citizenfx/decorators/client/on-client-resource-start.decorator";
export {
  OnClientResourceStop,
  OnClientResourceStopOptions,
} from "@citizenfx/decorators/client/on-client-resource-stop.decorator";
export { OnGameEvent, OnGameEventOptions } from "@citizenfx/decorators/client/on-game-event.decorator";
export { KeyState } from "@citizenfx/decorators/client/key-state.decorator";
export { NuiData } from "@citizenfx/decorators/client/nui-data.decorator";

export { EventBusService } from "@citizenfx/services/client-event-bus.service";

export { BytiumClientExecutionContextMap } from "@citizenfx/interfaces/bytium-client-execution-context-map.interface";
export { BytiumClientExecutionContext as BytiumExecutionContext } from "@citizenfx/types/bytium-client-execution-context.type";

import { createParamDecorator as createParamDecoratorBase } from "@core/utils/create-param-decorator.utils";
import { CreateParamDecorator } from "@core/types/create-param-decorator.type";
import { BytiumClientExecutionContext } from "@citizenfx/types/bytium-client-execution-context.type";

/**
 * Creates a custom parameter decorator that reads from the client execution context.
 */
export const createParamDecorator = createParamDecoratorBase as CreateParamDecorator<BytiumClientExecutionContext>;
