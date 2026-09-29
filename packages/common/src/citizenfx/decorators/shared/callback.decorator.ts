import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@Callback()`.
 */
export class CallbackOptions {
  /** Callback name. Globally scoped - keep it unique (e.g. `resource:feature:action`). */
  name: string;
}

/**
 * Registers a callback handler.
 *
 * @param name Callback name. Globally scoped - keep it unique (e.g. `resource:feature:action`).
 */
export function Callback(name: string): MethodDecorator;
/**
 * Registers a callback handler.
 *
 * @param options \@Callback() decorator options.
 */
export function Callback(options: CallbackOptions): MethodDecorator;
export function Callback(a: string | CallbackOptions): MethodDecorator {
  const callbackOptions = new CallbackOptions();

  Object.assign(callbackOptions, typeof a === "string" ? { name: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.CALLBACK, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, callbackOptions, target, propertyKey);
  };
}
