import { escapeColorCodes } from "@shared/utils/escape-color-codes.utils";

describe("escapeColorCodes", () => {
  describe.each([
    ["^1.3.0", "^​1.3.0"],
    ["^0.0.3", "^​0.0.3"],
    ["^1.3.0 and ^2.0.0", "^​1.3.0 and ^​2.0.0"],
    ["~1.3.0", "~1.3.0"],
    [">=1.3.0", ">=1.3.0"],
    ["^x", "^x"],
    ["1.x", "1.x"],
  ])("text %p", (text, expected) => {
    it("should keep a caret followed by a digit from being read as a console color code", () => {
      expect(escapeColorCodes(text)).toBe(expected);
    });
  });
});
