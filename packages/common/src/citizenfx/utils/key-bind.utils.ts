export function getControlInstructionalButtonForKeyBind(name: string): string {
  return GetControlInstructionalButton(0, GetHashKey(name), true);
}
