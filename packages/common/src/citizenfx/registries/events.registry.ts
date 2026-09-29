import { OnClientResourceStartOptions } from "@citizenfx/decorators/client/on-client-resource-start.decorator";
import { OnClientResourceStopOptions } from "@citizenfx/decorators/client/on-client-resource-stop.decorator";
import { OnConsoleOutputOptions } from "@citizenfx/decorators/server/on-console-output.decorator";
import { OnConvarChangeOptions } from "@citizenfx/decorators/shared/on-convar-change.decorator";
import { OnEventOptions } from "@citizenfx/decorators/shared/on-event.decorator";
import { OnGameEventOptions } from "@citizenfx/decorators/client/on-game-event.decorator";
import { OnNetEventOptions as ServerOnNetEventOptions } from "@citizenfx/decorators/server/on-net-event.decorator";
import { OnNetEventOptions as ClientOnNetEventOptions } from "@citizenfx/decorators/client/on-net-event.decorator";
import { OnResourceStartOptions } from "@citizenfx/decorators/shared/on-resource-start.decorator";
import { OnResourceStopOptions } from "@citizenfx/decorators/shared/on-resource-stop.decorator";
import { OnServerResourceStartOptions } from "@citizenfx/decorators/server/on-server-resource-start.decorator";
import { OnServerResourceStopOptions } from "@citizenfx/decorators/server/on-server-resource-stop.decorator";
import { HandlerInvoker } from "@core/invokers/handler.invoker";
import { AnyExecutionContext } from "@core/types/any-execution-context.type";
import { Logger } from "@logger";
import { ConstructorType } from "@shared";

export class EventsRegistry {
  readonly #logger = new Logger("bytium");
  readonly #isCitizenFXServer = IsDuplicityVersion();

  /**
   * Runs a handler for an event, honoring sync mode. In sync mode the handler is invoked
   * synchronously (same task as the event dispatch) so its sync prefix - e.g. `deferrals.defer()`
   * or `CancelEvent()` - runs before control returns to the runtime; the async tail is observed
   * via the returned promise. Otherwise the handler runs through the normal async pipeline.
   *
   * The callback that FiveM calls MUST stay synchronous (no `async`/`await` before this) for sync
   * mode to work - a single `await` would push the handler to a microtask and miss the window.
   */
  #runHandler(
    sync: boolean | undefined,
    handlerInvoker: HandlerInvoker,
    context: AnyExecutionContext,
    errorLabel: string,
  ): void {
    if (sync) {
      try {
        const result = handlerInvoker.invokeSync(context);

        Promise.resolve(result).catch((err) => this.#logger.error(errorLabel, err));
      } catch (err) {
        this.#logger.error(errorLabel, err);
      }

      return;
    }

    handlerInvoker.invoke(context).catch((err) => this.#logger.error(errorLabel, err));
  }

  registerClientResourceStartEventListener(
    instance: object,
    methodName: string,
    options: OnClientResourceStartOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    if (this.#isCitizenFXServer) {
      this.#logger.warn(
        `Tried to register @OnClientResourceStart event listener for method ${methodName} in provider ${provider.name} on the server, which is not correct since this event only works on the client.`,
      );

      return;
    }

    on("onClientResourceStart", (name: string) => {
      if (name !== options.name) return;

      const context = { type: "ON_CLIENT_RESOURCE_START", provider: instance, methodName };

      this.#runHandler(
        options.sync,
        handlerInvoker,
        context,
        `Error while handling @OnClientResourceStart on method ${methodName} in provider ${provider.name}:`,
      );
    });
  }

  registerClientResourceStopEventListener(
    instance: object,
    methodName: string,
    options: OnClientResourceStopOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    if (this.#isCitizenFXServer) {
      this.#logger.warn(
        `Tried to register @OnClientResourceStop event listener for method ${methodName} in provider ${provider.name} on the server, which is not correct since this event only works on the client.`,
      );

      return;
    }

    on("onClientResourceStop", (name: string) => {
      if (name !== options.name) return;

      const context = { type: "ON_CLIENT_RESOURCE_STOP", provider: instance, methodName };

      this.#runHandler(
        options.sync,
        handlerInvoker,
        context,
        `Error while handling @OnClientResourceStop on method ${methodName} in provider ${provider.name}:`,
      );
    });
  }

  registerConsoleOutputListener(
    instance: object,
    methodName: string,
    options: OnConsoleOutputOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    if (!this.#isCitizenFXServer) {
      this.#logger.warn(
        `Tried to register @OnConsoleOutput event listener for method ${methodName} in provider ${provider.name} on the client, which is not correct since this event only works on the server.`,
      );

      return;
    }

    RegisterConsoleListener((channel: string, message: string) => {
      if (channel !== options.channel) return;

      const context = { type: "ON_CONSOLE_OUTPUT", provider: instance, methodName, channel, message };

      this.#runHandler(
        options.sync,
        handlerInvoker,
        context,
        `Error while handling @OnConsoleOutput on method ${methodName} in provider ${provider.name}:`,
      );
    });
  }

  registerConvarChangeListener(
    instance: object,
    methodName: string,
    options: OnConvarChangeOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    AddConvarChangeListener(options.filter, (convarName: string) => {
      const context = { type: "ON_CONVAR_CHANGE", provider: instance, methodName, convarName };

      this.#runHandler(
        options.sync,
        handlerInvoker,
        context,
        `Error while handling @OnConvarChange on method ${methodName} in provider ${provider.name}:`,
      );
    });
  }

  registerEventListener(
    instance: object,
    methodName: string,
    options: OnEventOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    on(options.name, (...args: any[]) => {
      const source = global.source;
      const context = this.#isCitizenFXServer
        ? { type: "ON_EVENT", provider: instance, methodName, source, args }
        : { type: "ON_EVENT", provider: instance, methodName, args };

      this.#runHandler(
        options.sync,
        handlerInvoker,
        context,
        `Error while handling @OnEvent on method ${methodName} in provider ${provider.name}:`,
      );
    });
  }

  registerGameEventListener(
    instance: object,
    methodName: string,
    options: OnGameEventOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    on("gameEventTriggered", (gameEventName: string, ...args: any[]) => {
      if (gameEventName !== options.name) return;

      const context = { type: "ON_GAME_EVENT", provider: instance, methodName, args };

      this.#runHandler(
        options.sync,
        handlerInvoker,
        context,
        `Error while handling @OnGameEvent on method ${methodName} in provider ${provider.name}:`,
      );
    });
  }

  registerNetEventListener(
    instance: object,
    methodName: string,
    options: ServerOnNetEventOptions | ClientOnNetEventOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    onNet(options.name, (...args: any[]) => {
      const source = global.source;
      const context = this.#isCitizenFXServer
        ? { type: "ON_NET_EVENT", provider: instance, methodName, source, args }
        : { type: "ON_NET_EVENT", provider: instance, methodName, args };

      this.#runHandler(
        options.sync,
        handlerInvoker,
        context,
        `Error while handling @OnNetEvent on method ${methodName} in provider ${provider.name}:`,
      );
    });
  }

  registerResourceStartEventListener(
    instance: object,
    methodName: string,
    options: OnResourceStartOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    on("onResourceStart", (name: string) => {
      if (name !== options.name) return;

      const context = { type: "ON_RESOURCE_START", provider: instance, methodName };

      this.#runHandler(
        options.sync,
        handlerInvoker,
        context,
        `Error while handling @OnResourceStart on method ${methodName} in provider ${provider.name}:`,
      );
    });
  }

  registerResourceStopEventListener(
    instance: object,
    methodName: string,
    options: OnResourceStopOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    on("onResourceStop", (name: string) => {
      if (name !== options.name) return;

      const context = { type: "ON_RESOURCE_STOP", provider: instance, methodName };

      this.#runHandler(
        options.sync,
        handlerInvoker,
        context,
        `Error while handling @OnResourceStop on method ${methodName} in provider ${provider.name}:`,
      );
    });
  }

  registerServerResourceStartEventListener(
    instance: object,
    methodName: string,
    options: OnServerResourceStartOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    if (!this.#isCitizenFXServer) {
      this.#logger.warn(
        `Tried to register @OnServerResourceStart event listener for method ${methodName} in provider ${provider.name} on the client, which is not correct since this event only works on the server.`,
      );

      return;
    }

    on("onServerResourceStart", (name: string) => {
      if (name !== options.name) return;

      const context = { type: "ON_SERVER_RESOURCE_START", provider: instance, methodName };

      this.#runHandler(
        options.sync,
        handlerInvoker,
        context,
        `Error while handling @OnServerResourceStart on method ${methodName} in provider ${provider.name}:`,
      );
    });
  }

  registerServerResourceStopEventListener(
    instance: object,
    methodName: string,
    options: OnServerResourceStopOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    if (!this.#isCitizenFXServer) {
      this.#logger.warn(
        `Tried to register @OnServerResourceStop event listener for method ${methodName} in provider ${provider.name} on the client, which is not correct since this event only works on the server.`,
      );

      return;
    }

    on("onServerResourceStop", (name: string) => {
      if (name !== options.name) return;

      const context = { type: "ON_SERVER_RESOURCE_STOP", provider: instance, methodName };

      this.#runHandler(
        options.sync,
        handlerInvoker,
        context,
        `Error while handling @OnServerResourceStop on method ${methodName} in provider ${provider.name}:`,
      );
    });
  }
}
