import { BytiumResourceModule } from "@core/decorators/bytium-resource-module.decorator";
import { CallbacksService } from "@citizenfx/services/callbacks.service";
import { EventBusService as ServerEventBusService } from "@citizenfx/services/server-event-bus.service";
import { EventBusService as ClientEventBusService } from "@citizenfx/services/client-event-bus.service";
import { TicksRegistry } from "@citizenfx/registries/ticks.registry";
import { TicksService } from "@citizenfx/services/ticks.service";
import { Global } from "@core/decorators/global.decorator";
import { Reflector } from "@core/services/reflector.service";
import { HandlerInvoker } from "@core/invokers/handler.invoker";

const EventBusService = IsDuplicityVersion() ? ServerEventBusService : ClientEventBusService;

@Global()
@BytiumResourceModule({
  name: "__bytium_core__",
  providers: [TicksRegistry, CallbacksService, EventBusService, TicksService, Reflector, HandlerInvoker],
  exports: [EventBusService, TicksService, Reflector, HandlerInvoker],
})
export class BytiumCoreModule {}
