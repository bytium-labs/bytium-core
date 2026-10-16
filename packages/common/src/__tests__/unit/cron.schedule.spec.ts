import { CronExpressionParser } from "@citizenfx/parsers/cron-expression.parser";
import { CronSchedule } from "@citizenfx/schedules/cron.schedule";

const nextOccurrence = (expression: string, from: string, timeZone?: string): string =>
  CronSchedule.nextOccurrence(CronExpressionParser.parse(expression), new Date(from), timeZone).toISOString();

describe("CronSchedule", () => {
  describe("nextOccurrence - UTC", () => {
    it("should return the next daily midnight", () => {
      expect(nextOccurrence("0 0 * * *", "2026-01-15T12:34:00Z")).toBe("2026-01-16T00:00:00.000Z");
    });

    it("should return the next matching step minute", () => {
      expect(nextOccurrence("*/15 * * * *", "2026-01-15T12:07:00Z")).toBe("2026-01-15T12:15:00.000Z");
    });

    it("should skip forward to the next matching weekday", () => {
      expect(nextOccurrence("0 12 * * MON", "2026-01-15T00:00:00Z")).toBe("2026-01-19T12:00:00.000Z");
    });

    it("should return the first of the next month", () => {
      expect(nextOccurrence("0 0 1 * *", "2026-01-15T00:00:00Z")).toBe("2026-02-01T00:00:00.000Z");
    });

    it("should always advance strictly after `from`", () => {
      const first = nextOccurrence("0 * * * *", "2026-01-15T10:30:00Z");
      const second = nextOccurrence("0 * * * *", first);

      expect(first).toBe("2026-01-15T11:00:00.000Z");
      expect(second).toBe("2026-01-15T12:00:00.000Z");
    });
  });

  describe("nextOccurrence - day-of-month OR day-of-week rule", () => {
    it("should match either field when BOTH are restricted", () => {
      expect(nextOccurrence("0 0 13 * FRI", "2026-01-15T00:00:00Z")).toBe("2026-01-16T00:00:00.000Z");
    });
  });

  describe("nextOccurrence - L / W / # extensions", () => {
    it("should match the last day of the month (`L`)", () => {
      expect(nextOccurrence("0 0 L * *", "2026-02-10T00:00:00Z")).toBe("2026-02-28T00:00:00.000Z");
    });

    it("should match the last Friday of the month (`5L`)", () => {
      expect(nextOccurrence("0 0 * * 5L", "2026-01-01T00:00:00Z")).toBe("2026-01-30T00:00:00.000Z");
    });

    it("should match the 2nd Monday of the month (`1#2`)", () => {
      expect(nextOccurrence("0 0 * * 1#2", "2026-01-01T00:00:00Z")).toBe("2026-01-12T00:00:00.000Z");
    });

    it("should match the nearest weekday to the 15th (`15W`) when the 15th is a weekend", () => {
      expect(nextOccurrence("0 0 15W * *", "2026-02-01T00:00:00Z")).toBe("2026-02-16T00:00:00.000Z");
    });
  });

  describe("nextOccurrence - timezones (Europe/Warsaw)", () => {
    it("should apply the winter offset (UTC+1)", () => {
      expect(nextOccurrence("0 12 15 1 *", "2026-01-01T00:00:00Z", "Europe/Warsaw")).toBe("2026-01-15T11:00:00.000Z");
    });

    it("should apply the summer offset (UTC+2)", () => {
      expect(nextOccurrence("0 12 15 7 *", "2026-01-01T00:00:00Z", "Europe/Warsaw")).toBe("2026-07-15T10:00:00.000Z");
    });

    it("should skip a wall-clock time that does not exist due to spring-forward DST", () => {
      /**
       * 2026-03-29 02:30 Warsaw is skipped (clocks jump 02:00 -> 03:00), so the next 29 March 02:30
       * is in 2027, after that year's DST switch (UTC+2 -> 00:30 UTC).
       */
      expect(nextOccurrence("30 2 29 3 *", "2026-01-01T00:00:00Z", "Europe/Warsaw")).toBe("2027-03-29T00:30:00.000Z");
    });
  });
});
