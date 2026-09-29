import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@OnEvent()`.
 */
export class OnEventOptions {
  /** Event name. */
  name: string;

  /**
   * Run the handler synchronously in the same task as the event dispatch. Required for events whose
   * effects must be applied before control returns to the runtime - e.g. `deferrals.defer()` on
   * `playerConnecting` or `CancelEvent()` on cancelable events. In sync mode guards, param decorators
   * and pipes must be synchronous. Call `defer()`/`CancelEvent()` before any `await` in the handler.
   */
  sync?: boolean;
}

/**
 * Registers an event handler.
 *
 * @param name Event name.
 */
export function OnEvent(name: string): MethodDecorator;
/**
 * Registers an event handler.
 *
 * @param name Event name.
 * @param options \@OnEvent() decorator options.
 */
export function OnEvent(name: string, options: Omit<OnEventOptions, "name">): MethodDecorator;
/**
 * Registers an event handler.
 *
 * @param options \@OnEvent() decorator options.
 */
export function OnEvent(options: OnEventOptions): MethodDecorator;
export function OnEvent(a: string | OnEventOptions, b?: Omit<OnEventOptions, "name">): MethodDecorator {
  const onEventOptions = new OnEventOptions();

  Object.assign(onEventOptions, typeof a === "string" ? { name: a, ...b } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.ON_EVENT, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, onEventOptions, target, propertyKey);
  };
}
