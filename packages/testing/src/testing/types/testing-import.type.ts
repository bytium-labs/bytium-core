import {
  BytiumResourceDynamicModuleInterface,
  ConstructorType,
  ForwardRefDependencyInterface,
} from "@bytium-core/common";

/**
 * A module importable into a testing module.
 */
export type TestingImport =
  ConstructorType | ForwardRefDependencyInterface | BytiumResourceDynamicModuleInterface | string;
