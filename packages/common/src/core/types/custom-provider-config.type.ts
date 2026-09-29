import { ClassProviderInterface } from "@core/interfaces/class-provider.interface";
import { ExistingProviderInterface } from "@core/interfaces/existing-provider.interface";
import { FactoryProviderInterface } from "@core/interfaces/factory-provider.interface";
import { ValueProviderInterface } from "@core/interfaces/value-provider.interface";

/**
 * A custom provider configuration: factory, value, class, or existing-token form.
 */
export type CustomProviderConfigType =
  FactoryProviderInterface | ValueProviderInterface | ClassProviderInterface | ExistingProviderInterface;
