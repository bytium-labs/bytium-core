import { Injectable } from "@core/decorators/injectable.decorator";
import { TickOptions } from "@citizenfx/decorators/shared/tick.decorator";
import { RegisteredTickModel } from "@citizenfx/models/registered-tick";
import { TickAlreadyRegisteredException } from "@citizenfx/exceptions/tick-already-registered.exception";
import { ConstructorType } from "@shared";

@Injectable()
export class TicksRegistry {
  readonly #ticksByProviderAndMethodName: Map<ConstructorType, Map<string, RegisteredTickModel>> = new Map();

  registerTick(instance: object, methodName: string, options: TickOptions, provider: ConstructorType): void {
    let ticksByMethodName = this.#ticksByProviderAndMethodName.get(provider);

    if (!ticksByMethodName) {
      ticksByMethodName = new Map();
      this.#ticksByProviderAndMethodName.set(provider, ticksByMethodName);
    }

    if (ticksByMethodName.has(methodName)) {
      throw new TickAlreadyRegisteredException(
        `A tick is already registered for method ${methodName} in provider ${provider.name}.`,
      );
    }

    const handle = () => (instance as Record<string, () => unknown>)[methodName]();
    const tickEntity = new RegisteredTickModel(handle, options, provider, methodName);

    ticksByMethodName.set(methodName, tickEntity);

    if (options.autoStart) {
      tickEntity.start();
    }
  }

  getTickByProviderAndMethodName(provider: ConstructorType, methodName: string): RegisteredTickModel | undefined {
    return this.#ticksByProviderAndMethodName.get(provider)?.get(methodName);
  }

  getTicksByProvider(provider: ConstructorType): RegisteredTickModel[] {
    const ticksByMethodName = this.#ticksByProviderAndMethodName.get(provider);

    if (!ticksByMethodName) {
      return [];
    }

    return Array.from(ticksByMethodName.values());
  }
}
