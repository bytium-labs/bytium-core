export * from "@citizenfx";

export { Command, CommandOptions } from "@citizenfx/decorators/server/command.decorator";
export { NetCallback, NetCallbackOptions } from "@citizenfx/decorators/server/net-callback.decorator";
export { OnNetEvent, OnNetEventOptions } from "@citizenfx/decorators/server/on-net-event.decorator";
export { OnConsoleOutput, OnConsoleOutputOptions } from "@citizenfx/decorators/server/on-console-output.decorator";
export {
  OnServerResourceStart,
  OnServerResourceStartOptions,
} from "@citizenfx/decorators/server/on-server-resource-start.decorator";
export {
  OnServerResourceStop,
  OnServerResourceStopOptions,
} from "@citizenfx/decorators/server/on-server-resource-stop.decorator";

export { EventBusService } from "@citizenfx/services/server-event-bus.service";

export { BytiumServerExecutionContextMap } from "@citizenfx/interfaces/bytium-server-execution-context-map.interface";
export { BytiumServerExecutionContext as BytiumExecutionContext } from "@citizenfx/types/bytium-server-execution-context.type";

import { createParamDecorator as createParamDecoratorBase } from "@core/utils/create-param-decorator.utils";
import { CreateParamDecorator } from "@core/types/create-param-decorator.type";
import { BytiumServerExecutionContext } from "@citizenfx/types/bytium-server-execution-context.type";

/**
 * Creates a custom parameter decorator that reads from the server execution context.
 */
export const createParamDecorator = createParamDecoratorBase as CreateParamDecorator<BytiumServerExecutionContext>;
