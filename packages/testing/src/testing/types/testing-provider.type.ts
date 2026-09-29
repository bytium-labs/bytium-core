import {
  ClassProviderInterface,
  ConstructorType,
  ExistingProviderInterface,
  FactoryProviderInterface,
  ForwardRefDependencyInterface,
  ValueProviderInterface,
} from "@bytium-core/common";

/**
 * A provider registrable in a testing module.
 */
export type TestingProvider =
  | ConstructorType
  | ForwardRefDependencyInterface
  | FactoryProviderInterface
  | ValueProviderInterface
  | ClassProviderInterface
  | ExistingProviderInterface
  | string;
