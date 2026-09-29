import { ConstructorType } from "@shared";

/**
 * A lazily-resolved dependency reference, produced by `forwardRef()` to break a circular import.
 */
export interface ForwardRefDependencyInterface {
  forwardRef: () => ConstructorType;
}

export const instanceOfForwardRefDependency = (value: unknown): value is ForwardRefDependencyInterface => {
  return typeof value === "object" && value !== null && "forwardRef" in value && typeof value.forwardRef === "function";
};
