import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@OnClientResourceStart()`.
 */
export class OnClientResourceStartOptions {
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
 * Registers a client resource start handler.
 *
 * @param name Resource name.
 *
 * @remarks Client-side only.
 */
export function OnClientResourceStart(name: string): MethodDecorator;
/**
 * Registers a client resource start handler.
 *
 * @param options \@OnClientResourceStart() decorator options.
 *
 * @remarks Client-side only.
 */
export function OnClientResourceStart(options: OnClientResourceStartOptions): MethodDecorator;
export function OnClientResourceStart(a: string | OnClientResourceStartOptions): MethodDecorator {
  const onClientResourceStartOptions = new OnClientResourceStartOptions();

  Object.assign(onClientResourceStartOptions, typeof a === "string" ? { name: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(
      BytiumMetadataEnum.METHOD_TYPE,
      BytiumMethodTypeEnum.ON_CLIENT_RESOURCE_START,
      target,
      propertyKey,
    );
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, onClientResourceStartOptions, target, propertyKey);
  };
}
