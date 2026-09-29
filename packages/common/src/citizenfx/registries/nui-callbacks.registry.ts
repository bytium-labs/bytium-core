import { NUICallbackOptions } from "@citizenfx/decorators/client/nui-callback.decorator";
import { HandlerInvoker } from "@core/invokers/handler.invoker";
import { Logger } from "@logger";
import { ConstructorType } from "@shared";
import { serializeError } from "@citizenfx/utils/error-serialization.utils";

export class NUICallbacksRegistry {
  readonly #logger = new Logger("bytium");
  readonly #isCitizenFXServer = IsDuplicityVersion();

  registerNUICallback(
    instance: object,
    methodName: string,
    options: NUICallbackOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    if (this.#isCitizenFXServer) {
      this.#logger.warn(
        `Tried to register @NUICallback event listener for method ${methodName} in provider ${provider.name} on the server, which is not correct since this event only works on the client.`,
      );

      return;
    }

    try {
      RegisterNuiCallbackType(options.name);
      on(`__cfx_nui:${options.name}`, async (data: any, cb: (response: any) => void) => {
        try {
          const context = { type: "NUI_CALLBACK", provider: instance, methodName, data };

          cb(await handlerInvoker.invoke(context));
        } catch (err) {
          this.#logger.error(
            `Error while handling @NUICallback "${options.name}" on method ${methodName} in provider ${provider.name}:`,
            err,
          );
          cb(serializeError(err));
        }
      });

      this.#logger.debug(
        `Registered @NUICallback "${options.name}" on method ${methodName} in provider ${provider.name}.`,
      );
    } catch (err) {
      this.#logger.error(
        `Couldn't register @NUICallback "${options.name}" on method ${methodName} in provider ${provider.name}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err,
      );
    }
  }
}
