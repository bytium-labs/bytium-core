import { KeyBindOptions } from "@citizenfx/decorators/client/key-bind.decorator";
import { KeyBindStateEnum } from "@citizenfx/enums/key-bind-state.enum";
import { HandlerInvoker } from "@core/invokers/handler.invoker";
import { Logger } from "@logger";
import { ConstructorType } from "@shared";

export class KeyBindsRegistry {
  readonly #logger = new Logger("bytium");
  readonly #isCitizenFXServer = IsDuplicityVersion();

  registerKeyBind(
    instance: object,
    methodName: string,
    options: KeyBindOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    if (this.#isCitizenFXServer) {
      this.#logger.warn(
        `Tried to register @KeyBind event listener for method ${methodName} in provider ${provider.name} on the server, which is not correct since this event only works on the client.`,
      );

      return;
    }

    try {
      const invokeWithState = (state: KeyBindStateEnum) => {
        const context = { type: "KEY_BIND", provider: instance, methodName, state };

        return handlerInvoker.invoke(context);
      };
      let pressTimer: ReturnType<typeof setTimeout> | null = null;
      const handlePress = () => {
        invokeWithState(KeyBindStateEnum.PRESSED);

        if (options.holdDuration) {
          pressTimer = setTimeout(() => {
            invokeWithState(KeyBindStateEnum.HELD);
            pressTimer = null;
          }, options.holdDuration);
        }
      };
      const handleRelease = () => {
        if (pressTimer !== null) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }

        if (!options.onClickOnly) {
          invokeWithState(KeyBindStateEnum.RELEASED);
        }
      };

      RegisterCommand(`+${options.name}`, handlePress, false);
      RegisterCommand(`-${options.name}`, handleRelease, false);
      const description = options.description ?? "";

      RegisterKeyMapping(`+${options.name}`, description, options.inputGroup ?? "keyboard", options.defaultKey);

      if (options.alternateKey) {
        RegisterKeyMapping(
          `~!+${options.name}`,
          description + " (alternate)",
          options.inputGroup ?? "keyboard",
          options.alternateKey,
        );
      }

      this.#logger.debug(`Registered key bind "+${options.name}" / "-${options.name}" to key "${options.defaultKey}"`);
    } catch (err) {
      this.#logger.error(
        `Couldn't register @KeyBind on method ${methodName} in provider ${provider.name}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err,
      );
    }
  }
}
