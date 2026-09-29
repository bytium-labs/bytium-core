import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@NetCallback()`.
 */
export class NetCallbackOptions {
  /** Net callback name. Globally scoped - keep it unique (e.g. `resource:feature:action`). */
  name: string;
}

/**
 * Registers a net callback handler.
 *
 * @param name Net callback name. Globally scoped - keep it unique (e.g. `resource:feature:action`).
 *
 * @remarks Server-side only.
 */
export function NetCallback(name: string): MethodDecorator;
/**
 * Registers a net callback handler.
 *
 * @param options \@NetCallback() decorator options.
 *
 * @remarks Server-side only.
 */
export function NetCallback(options: NetCallbackOptions): MethodDecorator;
export function NetCallback(a: string | NetCallbackOptions): MethodDecorator {
  const netCallbackOptions = new NetCallbackOptions();

  Object.assign(netCallbackOptions, typeof a === "string" ? { name: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.NET_CALLBACK, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, netCallbackOptions, target, propertyKey);
  };
}
