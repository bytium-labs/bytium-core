import { Injectable } from "@core/decorators/injectable.decorator";
import { CallbacksService } from "@citizenfx/services/callbacks.service";

/**
 * Event bus service for emitting and listening to events. It also provides methods for invoking callbacks and sending NUI messages.
 */
@Injectable()
export class EventBusService {
  constructor(private readonly callbacksService: CallbacksService) {}

  /**
   * Emits an event; handlers subscribe with \@OnEvent.
   *
   * @param name Event name.
   * @param args Arguments forwarded to the handlers.
   */
  emit(name: string, ...args: any[]): void {
    emit(name, ...args);
  }

  /**
   * Emits a net event; handlers subscribe with \@OnNetEvent.
   *
   * @param name Net event name.
   * @param args Arguments forwarded to the handlers.
   */
  emitNet(name: string, ...args: any[]): void {
    emitNet(name, ...args);
  }

  /**
   * Invokes a callback and awaits its response; register handlers with \@Callback.
   *
   * @param name Callback name.
   * @param args Arguments forwarded to the handler.
   * @returns The handler's response.
   */
  invokeCallback<T>(name: string, ...args: any[]): Promise<T> {
    return this.callbacksService.invoke<T>(name, ...args);
  }

  /**
   * Invokes a net callback and awaits its response; register handlers with \@NetCallback.
   *
   * @param name Net callback name.
   * @param args Arguments forwarded to the handler.
   * @returns The handler's response.
   */
  invokeNetCallback<T>(name: string, ...args: any[]): Promise<T> {
    return this.callbacksService.invokeNet<T>(name, ...args);
  }

  /**
   * Sends a message to the NUI as JSON.
   *
   * @param data Object serialized to JSON and sent to the NUI.
   */
  sendNUIMessage<T extends object>(data: T): void {
    SendNuiMessage(JSON.stringify(data));
  }
}
