import { ConstructorType } from "@shared";
import { ForwardRefDependencyInterface } from "@core/interfaces/forward-ref-dependency.interface";

/**
 * A token a factory provider can inject: a class, string, symbol, or `forwardRef`.
 */
export type FactoryInjectToken = string | symbol | ConstructorType | ForwardRefDependencyInterface;
