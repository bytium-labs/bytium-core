import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@OnClientResourceStop()`.
 */
export class OnClientResourceStopOptions {
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
 * Registers a client resource stop handler.
 *
 * @param name Resource name.
 *
 * @remarks Client-side only.
 */
export function OnClientResourceStop(name: string): MethodDecorator;
/**
 * Registers a client resource stop handler.
 *
 * @param options \@OnClientResourceStop() decorator options.
 *
 * @remarks Client-side only.
 */
export function OnClientResourceStop(options: OnClientResourceStopOptions): MethodDecorator;
export function OnClientResourceStop(a: string | OnClientResourceStopOptions): MethodDecorator {
  const onClientResourceStopOptions = new OnClientResourceStopOptions();

  Object.assign(onClientResourceStopOptions, typeof a === "string" ? { name: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(
      BytiumMetadataEnum.METHOD_TYPE,
      BytiumMethodTypeEnum.ON_CLIENT_RESOURCE_STOP,
      target,
      propertyKey,
    );
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, onClientResourceStopOptions, target, propertyKey);
  };
}
