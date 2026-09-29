import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@OnResourceStop()`.
 */
export class OnResourceStopOptions {
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
 * Registers a resource stop handler.
 *
 * @param name Resource name.
 */
export function OnResourceStop(name: string): MethodDecorator;
/**
 * Registers a resource stop handler.
 *
 * @param options \@OnResourceStop() decorator options.
 */
export function OnResourceStop(options: OnResourceStopOptions): MethodDecorator;
export function OnResourceStop(a: string | OnResourceStopOptions): MethodDecorator {
  const onResourceStopOptions = new OnResourceStopOptions();

  Object.assign(onResourceStopOptions, typeof a === "string" ? { name: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.ON_RESOURCE_STOP, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, onResourceStopOptions, target, propertyKey);
  };
}
