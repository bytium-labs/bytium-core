import { ConstructorType, ForwardRefDependencyInterface } from "@bytium-core/common";

/**
 * A controller registrable in a testing module.
 */
export type TestingController = ConstructorType | ForwardRefDependencyInterface;
