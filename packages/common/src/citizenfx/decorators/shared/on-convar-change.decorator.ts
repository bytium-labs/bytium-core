import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@OnConvarChange()`.
 */
export class OnConvarChangeOptions {
  /**
   * Convar filter pattern. Supports wildcard `*` to match any convar name.
   *
   * @default "*"
   */
  filter = "*";

  /**
   * Run the handler synchronously in the same task as the event dispatch - required when the handler
   * must apply effects before control returns to the runtime (e.g. `CancelEvent()`). See `@OnEvent`
   * for details and constraints (guards/params/pipes must be synchronous).
   */
  sync?: boolean;
}

/**
 * Registers a convar change handler.
 *
 * @param filter Convar filter pattern; `*` matches any convar name.
 */
export function OnConvarChange(filter?: string): MethodDecorator;
/**
 * Registers a convar change handler.
 *
 * @param options \@OnConvarChange() decorator options.
 */
export function OnConvarChange(options?: OnConvarChangeOptions): MethodDecorator;
export function OnConvarChange(a?: string | OnConvarChangeOptions): MethodDecorator {
  const onConvarChangeOptions = new OnConvarChangeOptions();

  Object.assign(onConvarChangeOptions, typeof a === "string" ? { filter: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.ON_CONVAR_CHANGE, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, onConvarChangeOptions, target, propertyKey);
  };
}
