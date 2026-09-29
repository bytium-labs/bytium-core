import { ParsedCronExpression } from "@citizenfx/interfaces/parsed-cron-expression.interface";

const MONTH_NAMES: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};
const DAY_OF_WEEK_NAMES: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};
const MAX_DAY_ITERATIONS = 366 * 8;

export function parseCronExpression(expression: string): ParsedCronExpression {
  const fields = expression.trim().split(/\s+/);

  if (fields.length !== 5) {
    throw new Error(
      `Invalid cron expression "${expression}": expected 5 fields ` +
        `(minute hour day-of-month month day-of-week), got ${fields.length}.`,
    );
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;

  return {
    minutes: parseNumericField(minute, 0, 59, "minute"),
    hours: parseNumericField(hour, 0, 23, "hour"),
    months: parseNumericField(applyNames(month, MONTH_NAMES), 1, 12, "month"),
    daysOfMonth: parseDayOfMonth(dayOfMonth),
    daysOfWeek: parseDayOfWeek(dayOfWeek),
    dayOfMonthRestricted: dayOfMonth !== "*" && dayOfMonth !== "?",
    dayOfWeekRestricted: dayOfWeek !== "*" && dayOfWeek !== "?",
  };
}

export function getNextCronRun(parsed: ParsedCronExpression, from: Date, timeZone?: string): Date {
  const fromMs = from.getTime();
  const start = getWallParts(fromMs, timeZone);
  let year = start.year;
  let month = start.month;
  let day = start.day;

  for (let iteration = 0; iteration < MAX_DAY_ITERATIONS; iteration++) {
    const lastDay = daysInMonth(year, month);

    if (day <= lastDay && parsed.months.includes(month) && dayMatches(parsed, year, month, day, lastDay)) {
      for (const hour of parsed.hours) {
        for (const minute of parsed.minutes) {
          const epoch = wallClockToEpoch(year, month, day, hour, minute, timeZone);

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

  throw new Error(`Cron expression has no matching run within ${MAX_DAY_ITERATIONS} days.`);
}

function dayMatches(parsed: ParsedCronExpression, year: number, month: number, day: number, lastDay: number): boolean {
  const weekday = weekdayOf(year, month, day);
  const dayOfMonthOk = matchDayOfMonth(parsed.daysOfMonth, year, month, day, lastDay);
  const dayOfWeekOk = matchDayOfWeek(parsed.daysOfWeek, day, weekday, lastDay);

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

function matchDayOfMonth(
  field: ParsedCronExpression["daysOfMonth"],
  year: number,
  month: number,
  day: number,
  lastDay: number,
): boolean {
  if (field.values.includes(day)) return true;

  if (field.last && day === lastDay) return true;

  if (field.lastWeekday && day === lastWeekdayOfMonth(year, month, lastDay)) return true;

  for (const target of field.nearestWeekday) {
    if (day === nearestWeekday(year, month, target, lastDay)) return true;
  }

  return false;
}

function matchDayOfWeek(
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

function parseNumericField(raw: string, min: number, max: number, label: string): number[] {
  const values = new Set<number>();

  for (const token of raw.split(",")) {
    const [rangePart, stepPart] = token.split("/");
    const step = stepPart === undefined ? 1 : Number(stepPart);

    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`Invalid step "${stepPart}" in ${label} field.`);
    }

    let low: number;
    let high: number;

    if (rangePart === "*") {
      low = min;
      high = max;
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-");

      low = Number(a);
      high = Number(b);
    } else {
      low = Number(rangePart);
      high = stepPart === undefined ? low : max;
    }

    if (!Number.isInteger(low) || !Number.isInteger(high) || low < min || high > max || low > high) {
      throw new Error(`Invalid ${label} field value "${token}" (allowed ${min}-${max}).`);
    }

    for (let value = low; value <= high; value += step) {
      values.add(value);
    }
  }

  return [...values].sort((a, b) => a - b);
}

function parseDayOfMonth(raw: string): ParsedCronExpression["daysOfMonth"] {
  const field: ParsedCronExpression["daysOfMonth"] = {
    values: [],
    last: false,
    lastWeekday: false,
    nearestWeekday: [],
  };

  if (raw === "*" || raw === "?") {
    field.values = range(1, 31);

    return field;
  }

  const values = new Set<number>();

  for (const token of raw.split(",")) {
    const upper = token.toUpperCase();

    if (upper === "L") {
      field.last = true;
    } else if (upper === "LW") {
      field.lastWeekday = true;
    } else if (/^\d+W$/.test(upper)) {
      const target = Number(upper.slice(0, -1));

      if (target < 1 || target > 31) {
        throw new Error(`Invalid day-of-month value "${token}" (allowed 1-31).`);
      }

      field.nearestWeekday.push(target);
    } else {
      for (const value of parseNumericField(token, 1, 31, "day-of-month")) {
        values.add(value);
      }
    }
  }

  field.values = [...values].sort((a, b) => a - b);

  return field;
}

function parseDayOfWeek(raw: string): ParsedCronExpression["daysOfWeek"] {
  const field: ParsedCronExpression["daysOfWeek"] = { values: [], lastOf: [], nth: [] };

  if (raw === "*" || raw === "?") {
    field.values = range(0, 6);

    return field;
  }

  const values = new Set<number>();

  for (const token of applyNames(raw, DAY_OF_WEEK_NAMES).split(",")) {
    const upper = token.toUpperCase();
    const last = /^(\d+)L$/.exec(upper);
    const nth = /^(\d+)#(\d+)$/.exec(upper);

    if (last) {
      field.lastOf.push(normalizeWeekday(Number(last[1])));
    } else if (nth) {
      field.nth.push({ dayOfWeek: normalizeWeekday(Number(nth[1])), occurrence: Number(nth[2]) });
    } else {
      for (const value of parseNumericField(token, 0, 7, "day-of-week")) {
        values.add(normalizeWeekday(value));
      }
    }
  }

  field.values = [...values].sort((a, b) => a - b);

  return field;
}

function applyNames(raw: string, names: Record<string, number>): string {
  return raw.replace(/[A-Za-z]{3,}/g, (match) => {
    const value = names[match.toUpperCase()];

    if (value === undefined) {
      throw new Error(`Unknown name "${match}" in cron expression.`);
    }

    return String(value);
  });
}

function wallClockToEpoch(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone?: string,
): number | null {
  if (isUtc(timeZone)) {
    return Date.UTC(year, month - 1, day, hour, minute, 0);
  }

  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  // Offset fix-point: the tz offset can differ between the naive guess and the
  // corrected instant near a DST change, so resolve it against the corrected instant.
  let epoch = asUtc - tzOffsetMs(asUtc, timeZone as string);
  const refinedOffset = tzOffsetMs(epoch, timeZone as string);

  epoch = asUtc - refinedOffset;

  const check = getWallParts(epoch, timeZone);

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

function tzOffsetMs(epochMs: number, timeZone: string): number {
  const parts = getWallParts(epochMs, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  const epochMinute = Math.floor(epochMs / 60000) * 60000;

  return asUtc - epochMinute;
}

function getWallParts(
  epochMs: number,
  timeZone?: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  if (isUtc(timeZone)) {
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

function nearestWeekday(year: number, month: number, target: number, lastDay: number): number {
  const day = Math.min(target, lastDay);
  const weekday = weekdayOf(year, month, day);

  if (weekday === 6) {
    return day === 1 ? day + 2 : day - 1;
  }

  if (weekday === 0) {
    return day === lastDay ? day - 2 : day + 1;
  }

  return day;
}

function lastWeekdayOfMonth(year: number, month: number, lastDay: number): number {
  for (let day = lastDay; day >= 1; day--) {
    const weekday = weekdayOf(year, month, day);

    if (weekday !== 0 && weekday !== 6) return day;
  }

  return lastDay;
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function normalizeWeekday(value: number): number {
  return value === 7 ? 0 : value;
}

function isUtc(timeZone?: string): boolean {
  return !timeZone || timeZone.toUpperCase() === "UTC";
}

function range(min: number, max: number): number[] {
  const values: number[] = [];

  for (let value = min; value <= max; value++) {
    values.push(value);
  }

  return values;
}
