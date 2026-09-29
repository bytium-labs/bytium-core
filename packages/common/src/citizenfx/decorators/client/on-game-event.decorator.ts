import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@OnGameEvent()`.
 */
export class OnGameEventOptions {
  /** Game event name. */
  name: string;

  /**
   * Run the handler synchronously in the same task as the event dispatch - required when the handler
   * must apply effects before control returns to the runtime (e.g. `CancelEvent()`). See `@OnEvent`
   * for details and constraints (guards/params/pipes must be synchronous).
   */
  sync?: boolean;
}

/**
 * Registers a game event handler.
 *
 * See https://docs.fivem.net/docs/scripting-reference/events/client-events/#gameeventtriggered for more info.
 *
 * @param name Game event name.
 *
 * @remarks Client-side only.
 */
export function OnGameEvent(name: string): MethodDecorator;
/**
 * Registers a game event handler.
 *
 * See https://docs.fivem.net/docs/scripting-reference/events/client-events/#gameeventtriggered for more info.
 *
 * @param options \@OnGameEvent() decorator options.
 *
 * @remarks Client-side only.
 */
export function OnGameEvent(options: OnGameEventOptions): MethodDecorator;
export function OnGameEvent(a: string | OnGameEventOptions): MethodDecorator {
  const onGameEventOptions = new OnGameEventOptions();

  Object.assign(onGameEventOptions, typeof a === "string" ? { name: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.ON_GAME_EVENT, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, onGameEventOptions, target, propertyKey);
  };
}
