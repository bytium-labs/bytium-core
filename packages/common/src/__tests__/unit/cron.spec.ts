import { parseCronExpression, getNextCronRun } from "@citizenfx/utils/cron.utils";

const nextRun = (expression: string, from: string, timeZone?: string): string =>
  getNextCronRun(parseCronExpression(expression), new Date(from), timeZone).toISOString();

describe("cron.utils", () => {
  describe("parseCronExpression - fields", () => {
    it("should expand `*` to the full range for each field", () => {
      const parsed = parseCronExpression("* * * * *");

      expect(parsed.minutes).toHaveLength(60);
      expect(parsed.hours).toHaveLength(24);
      expect(parsed.months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it("should parse lists, ranges and steps", () => {
      expect(parseCronExpression("0,30 * * * *").minutes).toEqual([0, 30]);
      expect(parseCronExpression("0 9-17 * * *").hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
      expect(parseCronExpression("*/15 * * * *").minutes).toEqual([0, 15, 30, 45]);
      expect(parseCronExpression("5/20 * * * *").minutes).toEqual([5, 25, 45]);
      expect(parseCronExpression("1-30/10 * * * *").minutes).toEqual([1, 11, 21]);
    });

    it("should resolve month and day-of-week names", () => {
      expect(parseCronExpression("0 0 * JAN,MAR *").months).toEqual([1, 3]);
      expect(parseCronExpression("0 0 * * MON-FRI").daysOfWeek.values).toEqual([1, 2, 3, 4, 5]);
    });

    it("should normalize day-of-week 7 to 0 (Sunday)", () => {
      expect(parseCronExpression("0 0 * * 7").daysOfWeek.values).toEqual([0]);
    });

    it("should treat `?` like `*` and leave the field unrestricted", () => {
      const parsed = parseCronExpression("0 0 ? * *");

      expect(parsed.dayOfMonthRestricted).toBe(false);
      expect(parsed.daysOfMonth.values).toHaveLength(31);
    });

    it("should throw on the wrong number of fields", () => {
      expect(() => parseCronExpression("* * * *")).toThrow(/expected 5 fields/);
    });

    it("should throw on out-of-range values and bad steps", () => {
      expect(() => parseCronExpression("60 * * * *")).toThrow(/minute/);
      expect(() => parseCronExpression("*/0 * * * *")).toThrow(/step/);
    });
  });

  describe("getNextCronRun - UTC", () => {
    it("should return the next daily midnight", () => {
      expect(nextRun("0 0 * * *", "2026-01-15T12:34:00Z")).toBe("2026-01-16T00:00:00.000Z");
    });

    it("should return the next matching step minute", () => {
      expect(nextRun("*/15 * * * *", "2026-01-15T12:07:00Z")).toBe("2026-01-15T12:15:00.000Z");
    });

    it("should skip forward to the next matching weekday", () => {
      expect(nextRun("0 12 * * MON", "2026-01-15T00:00:00Z")).toBe("2026-01-19T12:00:00.000Z");
    });

    it("should return the first of the next month", () => {
      expect(nextRun("0 0 1 * *", "2026-01-15T00:00:00Z")).toBe("2026-02-01T00:00:00.000Z");
    });

    it("should always advance strictly after `from`", () => {
      const first = nextRun("0 * * * *", "2026-01-15T10:30:00Z");
      const second = nextRun("0 * * * *", first);

      expect(first).toBe("2026-01-15T11:00:00.000Z");
      expect(second).toBe("2026-01-15T12:00:00.000Z");
    });
  });

  describe("getNextCronRun - day-of-month OR day-of-week rule", () => {
    it("should match either field when BOTH are restricted", () => {
      expect(nextRun("0 0 13 * FRI", "2026-01-15T00:00:00Z")).toBe("2026-01-16T00:00:00.000Z");
    });
  });

  describe("getNextCronRun - L / W / # extensions", () => {
    it("should match the last day of the month (`L`)", () => {
      expect(nextRun("0 0 L * *", "2026-02-10T00:00:00Z")).toBe("2026-02-28T00:00:00.000Z");
    });

    it("should match the last Friday of the month (`5L`)", () => {
      expect(nextRun("0 0 * * 5L", "2026-01-01T00:00:00Z")).toBe("2026-01-30T00:00:00.000Z");
    });

    it("should match the 2nd Monday of the month (`1#2`)", () => {
      expect(nextRun("0 0 * * 1#2", "2026-01-01T00:00:00Z")).toBe("2026-01-12T00:00:00.000Z");
    });

    it("should match the nearest weekday to the 15th (`15W`) when the 15th is a weekend", () => {
      expect(nextRun("0 0 15W * *", "2026-02-01T00:00:00Z")).toBe("2026-02-16T00:00:00.000Z");
    });
  });

  describe("getNextCronRun - timezones (Europe/Warsaw)", () => {
    it("should apply the winter offset (UTC+1)", () => {
      expect(nextRun("0 12 15 1 *", "2026-01-01T00:00:00Z", "Europe/Warsaw")).toBe("2026-01-15T11:00:00.000Z");
    });

    it("should apply the summer offset (UTC+2)", () => {
      expect(nextRun("0 12 15 7 *", "2026-01-01T00:00:00Z", "Europe/Warsaw")).toBe("2026-07-15T10:00:00.000Z");
    });

    it("should skip a wall-clock time that does not exist due to spring-forward DST", () => {
      /**
       * 2026-03-29 02:30 Warsaw is skipped (clocks jump 02:00 -> 03:00), so the next 29 March 02:30
       * is in 2027, after that year's DST switch (UTC+2 -> 00:30 UTC).
       */
      expect(nextRun("30 2 29 3 *", "2026-01-01T00:00:00Z", "Europe/Warsaw")).toBe("2027-03-29T00:30:00.000Z");
    });
  });
});
