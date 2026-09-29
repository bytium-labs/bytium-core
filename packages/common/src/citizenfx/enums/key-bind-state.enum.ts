/**
 * State of a key binding when its `@KeyBind` handler fires.
 */
export enum KeyBindStateEnum {
  /** Key was pressed (instant). */
  PRESSED = "PRESSED",

  /** Key was held for the full holdDuration. */
  HELD = "HELD",

  /** Key was released. */
  RELEASED = "RELEASED",
}
