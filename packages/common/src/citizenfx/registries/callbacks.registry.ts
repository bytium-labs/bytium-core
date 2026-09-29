import { CallbackOptions } from "@citizenfx/decorators/shared/callback.decorator";
import { NetCallbackOptions as ServerNetCallbackOptions } from "@citizenfx/decorators/server/net-callback.decorator";
import { NetCallbackOptions as ClientNetCallbackOptions } from "@citizenfx/decorators/client/net-callback.decorator";
import { HandlerInvoker } from "@core/invokers/handler.invoker";
import { Logger } from "@logger";
import { ConstructorType } from "@shared";
import { serializeError } from "@citizenfx/utils/error-serialization.utils";

export class CallbacksRegistry {
  readonly #logger = new Logger("bytium");
  readonly #isCitizenFXServer = IsDuplicityVersion();

  registerCallback(
    instance: object,
    methodName: string,
    options: CallbackOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    on(`__bytium_callbackCall:${options.name}`, async (responseIdentifier: string, ...args: any[]) => {
      try {
        const context = { type: "CALLBACK", provider: instance, methodName, args };
        const result = await handlerInvoker.invoke(context);

        emit(`__bytium_callbackResponse:${options.name}`, responseIdentifier, result);
      } catch (err) {
        this.#logger.error(`Error while handling @Callback on method ${methodName} in provider ${provider.name}:`, err);
        emit(`__bytium_callbackResponse:${options.name}`, responseIdentifier, serializeError(err));
      }
    });
  }

  registerNetCallback(
    instance: object,
    methodName: string,
    options: ServerNetCallbackOptions | ClientNetCallbackOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    onNet(`__bytium_netCallbackCall:${options.name}`, async (responseIdentifier: string, ...args: any[]) => {
      const source = global.source;

      try {
        const context = this.#isCitizenFXServer
          ? { type: "NET_CALLBACK", provider: instance, methodName, source, args }
          : { type: "NET_CALLBACK", provider: instance, methodName, args };
        const result = await handlerInvoker.invoke(context);

        emitNet(
          `__bytium_netCallbackResponse:${options.name}`,
          ...(this.#isCitizenFXServer ? [source, responseIdentifier, result] : [responseIdentifier, result]),
        );
      } catch (err) {
        this.#logger.error(
          `Error while handling @NetCallback on method ${methodName} in provider ${provider.name}:`,
          err,
        );
        emitNet(
          `__bytium_netCallbackResponse:${options.name}`,
          ...(this.#isCitizenFXServer
            ? [source, responseIdentifier, serializeError(err)]
            : [responseIdentifier, serializeError(err)]),
        );
      }
    });
  }
}
