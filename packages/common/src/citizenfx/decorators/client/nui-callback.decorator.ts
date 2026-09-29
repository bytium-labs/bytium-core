import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@NUICallback()`.
 */
export class NUICallbackOptions {
  /** NUI callback name. */
  name: string;
}

/**
 * Registers a NUI callback handler.
 *
 * @param name NUI callback name.
 *
 * @remarks Client-side only.
 */
export function NUICallback(name: string): MethodDecorator;
/**
 * Registers a NUI callback handler.
 *
 * @param options \@NUICallback() decorator options.
 *
 * @remarks Client-side only.
 */
export function NUICallback(options: NUICallbackOptions): MethodDecorator;
export function NUICallback(a: string | NUICallbackOptions): MethodDecorator {
  const nuiCallbackOptions = new NUICallbackOptions();

  Object.assign(nuiCallbackOptions, typeof a === "string" ? { name: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.NUI_CALLBACK, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, nuiCallbackOptions, target, propertyKey);
  };
}
