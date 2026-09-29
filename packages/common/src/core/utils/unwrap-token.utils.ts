import { ConstructorType } from "@shared";

export function unwrapToken(
  item:
    | ConstructorType
    | string
    | symbol
    | { forwardRef: () => ConstructorType }
    | { module: ConstructorType }
    | null
    | undefined,
): ConstructorType | string | symbol | null {
  if (!item) return null;

  if (typeof item === "object" && "forwardRef" in item && typeof item.forwardRef === "function") {
    return item.forwardRef();
  }

  if (typeof item === "object" && "module" in item) {
    return item.module;
  }

  return item as ConstructorType | string | symbol;
}
