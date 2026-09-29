import { FactoryProviderInterface } from "@core/interfaces/factory-provider.interface";
import { ValueProviderInterface } from "@core/interfaces/value-provider.interface";
import { ClassProviderInterface } from "@core/interfaces/class-provider.interface";
import { ConstructorType } from "@shared";

/**
 * Anything registrable as a provider: a class or a custom provider configuration.
 */
export type ProviderType<T = any> =
  ConstructorType | FactoryProviderInterface<T> | ValueProviderInterface<T> | ClassProviderInterface;
