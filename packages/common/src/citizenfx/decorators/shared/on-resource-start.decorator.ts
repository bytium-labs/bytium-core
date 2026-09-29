import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@OnResourceStart()`.
 */
export class OnResourceStartOptions {
  /** Resource name. */
  name: string;

  /**
   * Run the handler synchronously in the same task as the event dispatch - required when the handler
   * must apply effects before control returns to the runtime (e.g. `CancelEvent()`). See `@OnEvent`
   * for details and constraints (guards/params/pipes must be synchronous).
   */
  sync?: boolean;
}

/**
 * Registers a resource start handler.
 *
 * @param name Resource name.
 */
export function OnResourceStart(name: string): MethodDecorator;
/**
 * Registers a resource start handler.
 *
 * @param options \@OnResourceStart() decorator options.
 */
export function OnResourceStart(options: OnResourceStartOptions): MethodDecorator;
export function OnResourceStart(a: string | OnResourceStartOptions): MethodDecorator {
  const onResourceStartOptions = new OnResourceStartOptions();

  Object.assign(onResourceStartOptions, typeof a === "string" ? { name: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.ON_RESOURCE_START, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, onResourceStartOptions, target, propertyKey);
  };
}
