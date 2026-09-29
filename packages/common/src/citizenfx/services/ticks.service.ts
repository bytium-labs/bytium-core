import { Injectable } from "@core/decorators/injectable.decorator";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { Inject } from "@core/decorators/inject.decorator";
import { TicksRegistry } from "@citizenfx/registries/ticks.registry";
import { TickNotFoundException } from "@citizenfx/exceptions/tick-not-found.exception";
import { ConstructorType, INQUIRER } from "@shared";

/**
 * Manages ticks registered with `@Tick()` - start or stop individual ticks, or all ticks for a provider.
 */
@Injectable({ scope: BytiumProviderScopeEnum.TRANSIENT })
export class TicksService {
  readonly #provider: ConstructorType;

  constructor(
    private readonly ticksRegistry: TicksRegistry,
    @Inject(INQUIRER) inquirer: object,
  ) {
    this.#provider = inquirer.constructor as ConstructorType;
  }

  /**
   * Starts a tick by its method name or reference.
   *
   * @param method The method name or method reference of the tick to start.
   */
  start(method: string | (() => void)): void {
    const methodName = typeof method === "function" ? method.name : method;
    const tick = this.ticksRegistry.getTickByProviderAndMethodName(this.#provider, methodName);

    if (!tick) {
      throw new TickNotFoundException(
        `Tried to start a tick for method ${methodName} in provider ${this.#provider.name} but it does not exist.`,
      );
    }

    tick.start();
  }

  /**
   * Stops a tick by its method name or reference.
   *
   * @param method The method name or method reference of the tick to stop.
   */
  stop(method: string | (() => void)): void {
    const methodName = typeof method === "function" ? method.name : method;
    const tick = this.ticksRegistry.getTickByProviderAndMethodName(this.#provider, methodName);

    if (!tick) {
      throw new TickNotFoundException(
        `Tried to stop a tick for method ${methodName} in provider ${this.#provider.name} but it does not exist.`,
      );
    }

    tick.stop();
  }

  /**
   * Starts all ticks registered for the provider.
   */
  startAll(): void {
    this.ticksRegistry.getTicksByProvider(this.#provider).forEach((tick) => tick.start());
  }

  /**
   * Stops all ticks registered for the provider.
   */
  stopAll(): void {
    this.ticksRegistry.getTicksByProvider(this.#provider).forEach((tick) => tick.stop());
  }
}
