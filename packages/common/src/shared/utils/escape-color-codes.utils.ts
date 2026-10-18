// the FiveM console reads a caret followed by a digit as a color code and drops both characters
export function escapeColorCodes(text: string): string {
  return text.replace(/\^(?=\d)/g, "^​");
}
