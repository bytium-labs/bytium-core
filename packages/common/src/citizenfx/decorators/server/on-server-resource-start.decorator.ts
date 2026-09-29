import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@OnServerResourceStart()`.
 */
export class OnServerResourceStartOptions {
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
 * Registers a server resource start handler.
 *
 * @param name Resource name.
 *
 * @remarks Server-side only.
 */
export function OnServerResourceStart(name: string): MethodDecorator;
/**
 * Registers a server resource start handler.
 *
 * @param options \@OnServerResourceStart() decorator options.
 *
 * @remarks Server-side only.
 */
export function OnServerResourceStart(options: OnServerResourceStartOptions): MethodDecorator;
export function OnServerResourceStart(a: string | OnServerResourceStartOptions): MethodDecorator {
  const onServerResourceStartOptions = new OnServerResourceStartOptions();

  Object.assign(onServerResourceStartOptions, typeof a === "string" ? { name: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(
      BytiumMetadataEnum.METHOD_TYPE,
      BytiumMethodTypeEnum.ON_SERVER_RESOURCE_START,
      target,
      propertyKey,
    );
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, onServerResourceStartOptions, target, propertyKey);
  };
}
