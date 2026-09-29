import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@OnServerResourceStop()`.
 */
export class OnServerResourceStopOptions {
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
 * Registers a server resource stop handler.
 *
 * @param name Resource name.
 *
 * @remarks Server-side only.
 */
export function OnServerResourceStop(name: string): MethodDecorator;
/**
 * Registers a server resource stop handler.
 *
 * @param options \@OnServerResourceStop() decorator options.
 *
 * @remarks Server-side only.
 */
export function OnServerResourceStop(options: OnServerResourceStopOptions): MethodDecorator;
export function OnServerResourceStop(a: string | OnServerResourceStopOptions): MethodDecorator {
  const onServerResourceStopOptions = new OnServerResourceStopOptions();

  Object.assign(onServerResourceStopOptions, typeof a === "string" ? { name: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(
      BytiumMetadataEnum.METHOD_TYPE,
      BytiumMethodTypeEnum.ON_SERVER_RESOURCE_STOP,
      target,
      propertyKey,
    );
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, onServerResourceStopOptions, target, propertyKey);
  };
}
