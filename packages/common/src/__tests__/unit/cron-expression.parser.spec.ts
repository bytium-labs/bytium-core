import { CronExpressionParser } from "@citizenfx/parsers/cron-expression.parser";

describe("CronExpressionParser", () => {
  it("should expand `*` to the full range for each field", () => {
    const parsed = CronExpressionParser.parse("* * * * *");

    expect(parsed.minutes).toHaveLength(60);
    expect(parsed.hours).toHaveLength(24);
    expect(parsed.months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("should parse lists, ranges and steps", () => {
    expect(CronExpressionParser.parse("0,30 * * * *").minutes).toEqual([0, 30]);
    expect(CronExpressionParser.parse("0 9-17 * * *").hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(CronExpressionParser.parse("*/15 * * * *").minutes).toEqual([0, 15, 30, 45]);
    expect(CronExpressionParser.parse("5/20 * * * *").minutes).toEqual([5, 25, 45]);
    expect(CronExpressionParser.parse("1-30/10 * * * *").minutes).toEqual([1, 11, 21]);
  });

  it("should resolve month and day-of-week names", () => {
    expect(CronExpressionParser.parse("0 0 * JAN,MAR *").months).toEqual([1, 3]);
    expect(CronExpressionParser.parse("0 0 * * MON-FRI").daysOfWeek.values).toEqual([1, 2, 3, 4, 5]);
  });

  it("should normalize day-of-week 7 to 0 (Sunday)", () => {
    expect(CronExpressionParser.parse("0 0 * * 7").daysOfWeek.values).toEqual([0]);
  });

  it("should treat `?` like `*` and leave the field unrestricted", () => {
    const parsed = CronExpressionParser.parse("0 0 ? * *");

    expect(parsed.dayOfMonthRestricted).toBe(false);
    expect(parsed.daysOfMonth.values).toHaveLength(31);
  });

  it("should throw on the wrong number of fields", () => {
    expect(() => CronExpressionParser.parse("* * * *")).toThrow(/expected 5 fields/);
  });

  it("should throw on out-of-range values and bad steps", () => {
    expect(() => CronExpressionParser.parse("60 * * * *")).toThrow(/minute/);
    expect(() => CronExpressionParser.parse("*/0 * * * *")).toThrow(/step/);
  });
});
