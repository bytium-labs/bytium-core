import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";
import { InputGroupEnum } from "@citizenfx/enums/input-group.enum";

/**
 * Options for `@KeyBind()`.
 */
export class KeyBindOptions {
  /** Default key binding. */
  defaultKey: string;

  /** Bind command name. */
  name: string;

  /** Key description displayed in GTA V controls menu. */
  description?: string = "";

  /** Alternate key binding. */
  alternateKey?: string;

  /**
   * Input group for RegisterKeyMapping.
   *
   * @default InputGroupEnum.KEYBOARD
   */
  inputGroup?: InputGroupEnum = InputGroupEnum.KEYBOARD;

  /**
   * Delay in milliseconds before a hold is considered complete.
   *
   * @default 0
   */
  holdDuration?: number = 0;

  /**
   * When `true`, the handler ignores the release, reacting only to press and hold-complete.
   *
   * @default false
   */
  onClickOnly?: boolean = false;
}

/**
 * Registers a key bind handler.
 *
 * See https://docs.fivem.net/docs/game-references/input-mapper-parameter-ids/ for more info.
 *
 * @param defaultKey Default key binding.
 * @param name Bind command name.
 * @param description Key description displayed in GTA V controls menu.
 * @param options \@KeyBind() decorator options.
 *
 * @remarks Client-side only.
 */
export function KeyBind(
  defaultKey: string,
  name: string,
  description?: string,
  options?: Omit<KeyBindOptions, "name" | "description" | "defaultKey">,
): MethodDecorator;
/**
 * Registers a key bind handler.
 *
 * See https://docs.fivem.net/docs/game-references/input-mapper-parameter-ids/ for more info.
 *
 * @param options \@KeyBind() decorator options.
 *
 * @remarks Client-side only.
 */
export function KeyBind(options: KeyBindOptions): MethodDecorator;
export function KeyBind(
  a: string | KeyBindOptions,
  b?: string,
  c?: string,
  d?: Omit<KeyBindOptions, "name" | "description" | "defaultKey">,
): MethodDecorator {
  const keyBindOptions = new KeyBindOptions();

  Object.assign(keyBindOptions, typeof a === "string" ? { defaultKey: a, name: b, description: c ?? "", ...d } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.KEY_BIND, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, keyBindOptions, target, propertyKey);
  };
}
