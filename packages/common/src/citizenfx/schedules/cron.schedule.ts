import { ParsedCronExpression } from "@citizenfx/interfaces/parsed-cron-expression.interface";

export class CronSchedule {
  static readonly #MAX_DAY_ITERATIONS = 366 * 8;

  static nextOccurrence(parsed: ParsedCronExpression, from: Date, timeZone?: string): Date {
    const fromMs = from.getTime();
    const start = this.#getWallParts(fromMs, timeZone);
    let year = start.year;
    let month = start.month;
    let day = start.day;

    for (let iteration = 0; iteration < this.#MAX_DAY_ITERATIONS; iteration++) {
      const lastDay = this.#daysInMonth(year, month);

      if (day <= lastDay && parsed.months.includes(month) && this.#dayMatches(parsed, year, month, day, lastDay)) {
        for (const hour of parsed.hours) {
          for (const minute of parsed.minutes) {
            const epoch = this.#wallClockToEpoch(year, month, day, hour, minute, timeZone);

            if (epoch !== null && epoch > fromMs) {
              return new Date(epoch);
            }
          }
        }
      }

      day++;

      if (day > lastDay) {
        day = 1;
        month++;

        if (month > 12) {
          month = 1;
          year++;
        }
      }
    }

    throw new Error(`Cron expression has no matching run within ${this.#MAX_DAY_ITERATIONS} days.`);
  }

  static #dayMatches(parsed: ParsedCronExpression, year: number, month: number, day: number, lastDay: number): boolean {
    const weekday = this.#weekdayOf(year, month, day);
    const dayOfMonthOk = this.#matchDayOfMonth(parsed.daysOfMonth, year, month, day, lastDay);
    const dayOfWeekOk = this.#matchDayOfWeek(parsed.daysOfWeek, day, weekday, lastDay);

    // Vixie-cron rule: when BOTH day-of-month and day-of-week are restricted, a day
    // matches if EITHER matches; when only one is restricted, only that one counts.
    if (parsed.dayOfMonthRestricted && parsed.dayOfWeekRestricted) {
      return dayOfMonthOk || dayOfWeekOk;
    }

    if (parsed.dayOfMonthRestricted) {
      return dayOfMonthOk;
    }

    if (parsed.dayOfWeekRestricted) {
      return dayOfWeekOk;
    }

    return true;
  }

  static #matchDayOfMonth(
    field: ParsedCronExpression["daysOfMonth"],
    year: number,
    month: number,
    day: number,
    lastDay: number,
  ): boolean {
    if (field.values.includes(day)) return true;

    if (field.last && day === lastDay) return true;

    if (field.lastWeekday && day === this.#lastWeekdayOfMonth(year, month, lastDay)) return true;

    for (const target of field.nearestWeekday) {
      if (day === this.#nearestWeekday(year, month, target, lastDay)) return true;
    }

    return false;
  }

  static #matchDayOfWeek(
    field: ParsedCronExpression["daysOfWeek"],
    day: number,
    weekday: number,
    lastDay: number,
  ): boolean {
    if (field.values.includes(weekday)) return true;

    for (const wanted of field.lastOf) {
      if (weekday === wanted && day > lastDay - 7) return true;
    }

    for (const { dayOfWeek, occurrence } of field.nth) {
      if (weekday === dayOfWeek && Math.floor((day - 1) / 7) + 1 === occurrence) return true;
    }

    return false;
  }

  static #wallClockToEpoch(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timeZone?: string,
  ): number | null {
    if (this.#isUtc(timeZone)) {
      return Date.UTC(year, month - 1, day, hour, minute, 0);
    }

    const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    // Offset fix-point: the tz offset can differ between the naive guess and the
    // corrected instant near a DST change, so resolve it against the corrected instant.
    let epoch = asUtc - this.#tzOffsetMs(asUtc, timeZone as string);
    const refinedOffset = this.#tzOffsetMs(epoch, timeZone as string);

    epoch = asUtc - refinedOffset;

    const check = this.#getWallParts(epoch, timeZone);

    // A wall-clock time skipped by spring-forward never round-trips — it does not exist.
    if (
      check.year !== year ||
      check.month !== month ||
      check.day !== day ||
      check.hour !== hour ||
      check.minute !== minute
    ) {
      return null;
    }

    return epoch;
  }

  static #tzOffsetMs(epochMs: number, timeZone: string): number {
    const parts = this.#getWallParts(epochMs, timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const epochMinute = Math.floor(epochMs / 60000) * 60000;

    return asUtc - epochMinute;
  }

  static #getWallParts(
    epochMs: number,
    timeZone?: string,
  ): { year: number; month: number; day: number; hour: number; minute: number } {
    if (this.#isUtc(timeZone)) {
      const date = new Date(epochMs);

      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
      };
    }

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts: Record<string, string> = {};

    for (const part of formatter.formatToParts(new Date(epochMs))) {
      if (part.type !== "literal") parts[part.type] = part.value;
    }

    const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour,
      minute: Number(parts.minute),
    };
  }

  static #nearestWeekday(year: number, month: number, target: number, lastDay: number): number {
    const day = Math.min(target, lastDay);
    const weekday = this.#weekdayOf(year, month, day);

    if (weekday === 6) {
      return day === 1 ? day + 2 : day - 1;
    }

    if (weekday === 0) {
      return day === lastDay ? day - 2 : day + 1;
    }

    return day;
  }

  static #lastWeekdayOfMonth(year: number, month: number, lastDay: number): number {
    for (let day = lastDay; day >= 1; day--) {
      const weekday = this.#weekdayOf(year, month, day);

      if (weekday !== 0 && weekday !== 6) return day;
    }

    return lastDay;
  }

  static #weekdayOf(year: number, month: number, day: number): number {
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }

  static #daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  static #isUtc(timeZone?: string): boolean {
    return !timeZone || timeZone.toUpperCase() === "UTC";
  }
}
