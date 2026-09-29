/**
 * Input group a key binding is registered under (FiveM input-mapper category).
 */
export enum InputGroupEnum {
  /** Controller button input as axis input. */
  DIGITALBUTTON_AXIS = "DIGITALBUTTON_AXIS",

  /** Game controlled input. */
  GAME_CONTROLLED = "GAME_CONTROLLED",

  /** Joystick / flight stick axis input. */
  JOYSTICK_AXIS = "JOYSTICK_AXIS",

  /** Joystick / flight stick axis input (always negative). */
  JOYSTICK_AXIS_NEGATIVE = "JOYSTICK_AXIS_NEGATIVE",

  /** Joystick / flight stick axis input (always positive). */
  JOYSTICK_AXIS_POSITIVE = "JOYSTICK_AXIS_POSITIVE",

  /** Joystick / flight stick button input. */
  JOYSTICK_BUTTON = "JOYSTICK_BUTTON",

  /** Joystick / flight stick axis input (inverted). */
  JOYSTICK_IAXIS = "JOYSTICK_IAXIS",

  /** Joystick / flight stick point of view input. */
  JOYSTICK_POV = "JOYSTICK_POV",

  /** Joystick / flight stick point of view axis input. */
  JOYSTICK_POV_AXIS = "JOYSTICK_POV_AXIS",

  /** Keyboard input (including the Xbox Controller Chatpad). */
  KEYBOARD = "KEYBOARD",

  /** Mouse & keyboard input as axis input. */
  MKB_AXIS = "MKB_AXIS",

  /** Mouse axis input (absolute). */
  MOUSE_ABSOLUTEAXIS = "MOUSE_ABSOLUTEAXIS",

  /** Mouse button input. */
  MOUSE_BUTTON = "MOUSE_BUTTON",

  /** Mouse button input (no known difference from MOUSE_BUTTON). */
  MOUSE_BUTTONANY = "MOUSE_BUTTONANY",

  /** Mouse axis input (centered). */
  MOUSE_CENTEREDAXIS = "MOUSE_CENTEREDAXIS",

  /** Mouse axis input (relative). */
  MOUSE_RELATIVEAXIS = "MOUSE_RELATIVEAXIS",

  /** Mouse axis input (scaled). */
  MOUSE_SCALEDAXIS = "MOUSE_SCALEDAXIS",

  /** Mouse axis input (normalized). */
  MOUSE_NORMALIZED = "MOUSE_NORMALIZED",

  /** Mouse wheel input. */
  MOUSE_WHEEL = "MOUSE_WHEEL",

  /** Controller trigger input. */
  PAD_ANALOGBUTTON = "PAD_ANALOGBUTTON",

  /** Controller axis input. */
  PAD_AXIS = "PAD_AXIS",

  /** Controller button input (debug interface, non functional). */
  PAD_DEBUGBUTTON = "PAD_DEBUGBUTTON",

  /** Controller button input. */
  PAD_DIGITALBUTTON = "PAD_DIGITALBUTTON",

  /** Controller button input (no known difference from PAD_DIGITALBUTTON). */
  PAD_DIGITALBUTTONANY = "PAD_DIGITALBUTTONANY",

  /** PS4/5 controller touchpad axis input (absolute). */
  TOUCHPAD_ABSOLUTE_AXIS = "TOUCHPAD_ABSOLUTE_AXIS",

  /** PS4/5 controller touchpad axis input (centered). */
  TOUCHPAD_CENTERED_AXIS = "TOUCHPAD_CENTERED_AXIS",
}
