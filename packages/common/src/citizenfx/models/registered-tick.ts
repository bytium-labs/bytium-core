import { TickOptions } from "@citizenfx/decorators/shared/tick.decorator";
import { Logger } from "@logger";
import { ConstructorType, sleep } from "@shared";

export class RegisteredTickModel {
  readonly #logger = new Logger("bytium");
  #tickId?: number;
  isRunning = false;

  constructor(
    public handle: () => void,
    public options: TickOptions,
    public provider: ConstructorType,
    public methodName: string,
  ) {}

  start(): void {
    if (!this.isRunning) {
      const interval = this.options.interval ?? 0;

      if (interval <= 0) {
        this.#tickId = setTick(async () => {
          try {
            await this.handle();
          } catch (err) {
            this.#logger.error(
              `Error while handling @Tick on method ${this.methodName} in provider ${this.provider.name}`,
              err,
            );
          }
        });
      } else {
        this.#tickId = setTick(async () => {
          try {
            await this.handle();
          } catch (err) {
            this.#logger.error(
              `Error while handling @Tick on method ${this.methodName} in provider ${this.provider.name}`,
              err,
            );
          } finally {
            await sleep(interval);
          }
        });
      }

      this.isRunning = true;
    } else {
      this.#logger.warn(
        `Tried to start a tick that is already running for method ${this.methodName} in provider ${this.provider.name}.`,
      );
    }
  }

  stop(): void {
    if (this.isRunning) {
      if (this.#tickId !== undefined) {
        clearTick(this.#tickId);
      }

      this.#tickId = undefined;
      this.isRunning = false;
    } else {
      this.#logger.warn(
        `Tried to stop a tick that is not running for method ${this.methodName} in provider ${this.provider.name}.`,
      );
    }
  }
}
