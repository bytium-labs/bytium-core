import { SemverRangeMatcher } from "@core/matchers/semver-range.matcher";

describe("SemverRangeMatcher", () => {
  describe.each([
    ["1.3.0", "1.3.0", true],
    ["1.3.0", "1.3.1", false],
    ["^1.3.0", "1.3.0", true],
    ["^1.3.0", "1.9.4", true],
    ["^1.3.0", "1.2.9", false],
    ["^1.3.0", "2.0.0", false],
    ["^0.3.1", "0.3.9", true],
    ["^0.3.1", "0.4.0", false],
    ["^0.0.3", "0.0.3", true],
    ["^0.0.3", "0.0.4", false],
    ["~1.3.0", "1.3.7", true],
    ["~1.3.0", "1.4.0", false],
    ["~1.3.2", "1.3.1", false],
    [">=1.3.0", "1.3.0", true],
    [">=1.3.0", "5.0.0", true],
    [">=1.3.0", "1.2.99", false],
    ["1.x", "1.0.0", true],
    ["1.x", "1.99.0", true],
    ["1.x", "2.0.0", false],
    ["1.3.x", "1.3.9", true],
    ["1.3.x", "1.4.0", false],
    ["x", "0.0.1", true],
    ["*", "42.0.0", true],
    ["1.X", "1.5.0", true],
  ])("range %s against version %s", (range, version, expected) => {
    it(`should ${expected ? "" : "not "}be satisfied`, () => {
      expect(SemverRangeMatcher.satisfies(version, range)).toBe(expected);
    });
  });

  describe.each(["^1.3", "~1", ">1.3.0", "1.3", "^1.x", "abc", "", "1.3.0-beta", "1.3.0 || 2.0.0"])(
    "unsupported range %p",
    (range) => {
      it("should be reported as invalid", () => {
        expect(SemverRangeMatcher.isValidRange(range)).toBe(false);
      });
    },
  );

  describe.each(["1.3.0", "^1.3.0", "~1.3.0", ">=1.3.0", "1.x", "1.3.x", "x", "*"])("supported range %p", (range) => {
    it("should be reported as valid", () => {
      expect(SemverRangeMatcher.isValidRange(range)).toBe(true);
    });
  });

  describe.each([
    ["1.3.0", true],
    ["10.20.30", true],
    ["1.3", false],
    ["v1.3.0", false],
    ["1.3.0-beta", false],
    ["", false],
  ])("version %p", (version, expected) => {
    it(`should ${expected ? "" : "not "}be a valid version`, () => {
      expect(SemverRangeMatcher.isValidVersion(version)).toBe(expected);
    });
  });
});
