import { ConstructorType } from "@shared";
import { ForwardRefDependencyInterface } from "@core/interfaces/forward-ref-dependency.interface";

/**
 * Defers resolving a dependency reference until runtime, to break a circular import between providers or modules.
 *
 * @param fn A function that returns the referenced class.
 */
export function forwardRef(fn: () => ConstructorType): ForwardRefDependencyInterface {
  return {
    forwardRef: fn,
  };
}
