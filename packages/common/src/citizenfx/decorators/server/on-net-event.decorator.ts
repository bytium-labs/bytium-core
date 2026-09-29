import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@OnNetEvent()`.
 */
export class OnNetEventOptions {
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
 * Registers a net event handler.
 *
 * @param name Event name.
 *
 * @remarks Server-side only.
 */
export function OnNetEvent(name: string): MethodDecorator;
/**
 * Registers a net event handler.
 *
 * @param options \@OnNetEvent() decorator options.
 *
 * @remarks Server-side only.
 */
export function OnNetEvent(options: OnNetEventOptions): MethodDecorator;
export function OnNetEvent(a: string | OnNetEventOptions): MethodDecorator {
  const netEventOptions = new OnNetEventOptions();

  Object.assign(netEventOptions, typeof a === "string" ? { name: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.ON_NET_EVENT, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, netEventOptions, target, propertyKey);
  };
}
