import { Injectable } from "@core/decorators/injectable.decorator";
import { Logger } from "@logger";
import { deserializeError } from "@citizenfx/utils/error-serialization.utils";
import { CallbackQueueEntryInterface } from "@citizenfx/interfaces/callback-queue-entry.interface";
import { SerializedErrorInterface } from "@citizenfx/interfaces/serialized-error.interface";

@Injectable()
export class CallbacksService {
  readonly #defaultTimeoutMs = 30000;
  readonly #logger = new Logger(CallbacksService.name);
  readonly #isCitizenFXServer = IsDuplicityVersion();
  readonly #callbackResponseQueue: Record<string, Record<string, CallbackQueueEntryInterface>> = {};
  readonly #netCallbackResponseQueue: Record<string, Record<string, CallbackQueueEntryInterface>> = {};
  readonly #currentResourceName = GetCurrentResourceName();

  #generateId(): string {
    return `${this.#currentResourceName}:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  #isSerializedError(value: unknown): value is SerializedErrorInterface {
    return value !== null && typeof value === "object" && !Array.isArray(value) && "__bytiumError" in value;
  }

  #dispatchResponse(
    queue: Record<string, Record<string, CallbackQueueEntryInterface>>,
    name: string,
    responseIdentifier: string,
    args: unknown[],
  ): void {
    const entry = queue[name]?.[responseIdentifier];

    if (!entry) return;

    delete queue[name][responseIdentifier];
    clearTimeout(entry.timer);

    if (args.length === 1 && this.#isSerializedError(args[0])) {
      entry.reject(deserializeError(args[0]));

      return;
    }

    entry.resolve(args[0]);
  }

  #createCallbackResponseListener(name: string, isNet = false): void {
    if (isNet) {
      onNet(`__bytium_netCallbackResponse:${name}`, (responseIdentifier: string, ...args: unknown[]) => {
        this.#dispatchResponse(this.#netCallbackResponseQueue, name, responseIdentifier, args);
      });
    } else {
      on(`__bytium_callbackResponse:${name}`, (responseIdentifier: string, ...args: unknown[]) => {
        this.#dispatchResponse(this.#callbackResponseQueue, name, responseIdentifier, args);
      });
    }
  }

  invoke<T>(name: string, ...args: any[]): Promise<T> {
    if (!this.#callbackResponseQueue[name]) {
      this.#callbackResponseQueue[name] = {};

      this.#createCallbackResponseListener(name);
    }

    return new Promise<T>((resolve, reject) => {
      const responseIdentifier = this.#generateId();
      const timer = setTimeout(() => {
        delete this.#callbackResponseQueue[name][responseIdentifier];
        this.#logger.warn(`@Callback "${name}" timed out after ${this.#defaultTimeoutMs}ms.`);
        reject(new Error(`@Callback "${name}" timed out after ${this.#defaultTimeoutMs}ms.`));
      }, this.#defaultTimeoutMs);

      this.#callbackResponseQueue[name][responseIdentifier] = {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      };

      emit(`__bytium_callbackCall:${name}`, responseIdentifier, ...args);
    });
  }

  invokeNet<T>(name: string, ...args: any[]): Promise<T> {
    if (!this.#netCallbackResponseQueue[name]) {
      this.#netCallbackResponseQueue[name] = {};

      this.#createCallbackResponseListener(name, true);
    }

    return new Promise<T>((resolve, reject) => {
      const responseIdentifier = this.#generateId();
      const timer = setTimeout(() => {
        delete this.#netCallbackResponseQueue[name][responseIdentifier];
        this.#logger.warn(`@NetCallback "${name}" timed out after ${this.#defaultTimeoutMs}ms.`);
        reject(new Error(`@NetCallback "${name}" timed out after ${this.#defaultTimeoutMs}ms.`));
      }, this.#defaultTimeoutMs);

      this.#netCallbackResponseQueue[name][responseIdentifier] = {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      };

      if (this.#isCitizenFXServer) {
        const eventTarget = args.shift();

        emitNet(`__bytium_netCallbackCall:${name}`, eventTarget, responseIdentifier, ...args);
      } else {
        emitNet(`__bytium_netCallbackCall:${name}`, responseIdentifier, ...args);
      }
    });
  }
}
