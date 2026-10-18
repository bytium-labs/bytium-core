import { stringifySource } from "@citizenfx/utils/source.utils";
import { CallbackOptions } from "@citizenfx/decorators/shared/callback.decorator";
import { NetCallbackOptions as ServerNetCallbackOptions } from "@citizenfx/decorators/server/net-callback.decorator";
import { NetCallbackOptions as ClientNetCallbackOptions } from "@citizenfx/decorators/client/net-callback.decorator";
import { HandlerInvoker } from "@core/invokers/handler.invoker";
import { InvocationContext } from "@invocation/contexts/invocation.context";
import { Logger } from "@logger";
import { ConstructorType } from "@shared";
import { ErrorSerializer } from "@core/serializers/error.serializer";
import { boundaryLogManagerInstance } from "@invocation/managers/boundary-log.manager";
import { extractCorrelationEnvelope } from "@invocation/utils/correlation-envelope.utils";

export class CallbacksRegistry {
  readonly #logger = new Logger("bytium-core");
  readonly #isCitizenFXServer = IsDuplicityVersion();

  registerCallback(
    instance: object,
    methodName: string,
    options: CallbackOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    on(`__bytium_callbackCall:${options.name}`, async (responseIdentifier: string, ...rawArgs: any[]) => {
      const { args, correlationId } = extractCorrelationEnvelope(rawArgs);
      const context = { type: "CALLBACK", provider: instance, methodName, args, correlationId };

      await handlerInvoker.runCorrelated(context, async () => {
        if (boundaryLogManagerInstance.shouldLog(context.type)) {
          this.#logger.log(`Executing @Callback "${options.name}"`);
        }

        const startedAt = Date.now();

        try {
          const result = await handlerInvoker.invoke(context);

          emit(`__bytium_callbackResponse:${options.name}`, responseIdentifier, result);

          if (boundaryLogManagerInstance.shouldLog(context.type)) {
            this.#logResponse(`@Callback "${options.name}"`, "done", startedAt);
          }
        } catch (err) {
          this.#logger.error(
            `Error while handling @Callback on method ${methodName} in provider ${provider.name}:`,
            err,
          );
          emit(`__bytium_callbackResponse:${options.name}`, responseIdentifier, ErrorSerializer.serialize(err));
          this.#logResponse(`@Callback "${options.name}"`, "error", startedAt);
        }
      });
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
      const rawSource: unknown = global.source;
      const source = stringifySource(rawSource);
      const context = this.#isCitizenFXServer
        ? { type: "NET_CALLBACK", provider: instance, methodName, source, rawSource, args }
        : { type: "NET_CALLBACK", provider: instance, methodName, args };

      await handlerInvoker.runCorrelated(context, async () => {
        if (boundaryLogManagerInstance.shouldLog(context.type)) {
          this.#logger.log(`Executing @NetCallback "${options.name}"`);
        }

        const startedAt = Date.now();

        try {
          const result = await handlerInvoker.invoke(context);

          emitNet(
            `__bytium_netCallbackResponse:${options.name}`,
            ...(this.#isCitizenFXServer ? [source, responseIdentifier, result] : [responseIdentifier, result]),
          );

          if (boundaryLogManagerInstance.shouldLog(context.type)) {
            this.#logResponse(`@NetCallback "${options.name}"`, "done", startedAt);
          }
        } catch (err) {
          this.#logger.error(
            `Error while handling @NetCallback on method ${methodName} in provider ${provider.name}:`,
            err,
          );
          emitNet(
            `__bytium_netCallbackResponse:${options.name}`,
            ...(this.#isCitizenFXServer
              ? [source, responseIdentifier, ErrorSerializer.serialize(err)]
              : [responseIdentifier, ErrorSerializer.serialize(err)]),
          );
          this.#logResponse(`@NetCallback "${options.name}"`, "error", startedAt);
        }
      });
    });
  }

  #logResponse(label: string, outcome: "done" | "error", startedAt: number): void {
    const durationMs = Date.now() - startedAt;

    InvocationContext.scoped({ response: { outcome, durationMs } }, () =>
      this.#logger.log(`${label} -> ${outcome} (${durationMs}ms)`),
    );
  }
}
