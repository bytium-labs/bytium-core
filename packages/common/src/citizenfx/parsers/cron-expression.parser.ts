import { ParsedCronExpression } from "@citizenfx/interfaces/parsed-cron-expression.interface";

export class CronExpressionParser {
  static readonly #MONTH_NAMES: Record<string, number> = {
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

  static readonly #DAY_OF_WEEK_NAMES: Record<string, number> = {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
  };

  static parse(expression: string): ParsedCronExpression {
    const fields = expression.trim().split(/\s+/);

    if (fields.length !== 5) {
      throw new Error(
        `Invalid cron expression "${expression}": expected 5 fields ` +
          `(minute hour day-of-month month day-of-week), got ${fields.length}.`,
      );
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;

    return {
      minutes: this.#parseNumericField(minute, 0, 59, "minute"),
      hours: this.#parseNumericField(hour, 0, 23, "hour"),
      months: this.#parseNumericField(this.#applyNames(month, this.#MONTH_NAMES), 1, 12, "month"),
      daysOfMonth: this.#parseDayOfMonth(dayOfMonth),
      daysOfWeek: this.#parseDayOfWeek(dayOfWeek),
      dayOfMonthRestricted: dayOfMonth !== "*" && dayOfMonth !== "?",
      dayOfWeekRestricted: dayOfWeek !== "*" && dayOfWeek !== "?",
    };
  }

  static #parseNumericField(raw: string, min: number, max: number, label: string): number[] {
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

  static #parseDayOfMonth(raw: string): ParsedCronExpression["daysOfMonth"] {
    const field: ParsedCronExpression["daysOfMonth"] = {
      values: [],
      last: false,
      lastWeekday: false,
      nearestWeekday: [],
    };

    if (raw === "*" || raw === "?") {
      field.values = this.#range(1, 31);

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
        for (const value of this.#parseNumericField(token, 1, 31, "day-of-month")) {
          values.add(value);
        }
      }
    }

    field.values = [...values].sort((a, b) => a - b);

    return field;
  }

  static #parseDayOfWeek(raw: string): ParsedCronExpression["daysOfWeek"] {
    const field: ParsedCronExpression["daysOfWeek"] = { values: [], lastOf: [], nth: [] };

    if (raw === "*" || raw === "?") {
      field.values = this.#range(0, 6);

      return field;
    }

    const values = new Set<number>();

    for (const token of this.#applyNames(raw, this.#DAY_OF_WEEK_NAMES).split(",")) {
      const upper = token.toUpperCase();
      const last = /^(\d+)L$/.exec(upper);
      const nth = /^(\d+)#(\d+)$/.exec(upper);

      if (last) {
        field.lastOf.push(this.#normalizeWeekday(Number(last[1])));
      } else if (nth) {
        field.nth.push({ dayOfWeek: this.#normalizeWeekday(Number(nth[1])), occurrence: Number(nth[2]) });
      } else {
        for (const value of this.#parseNumericField(token, 0, 7, "day-of-week")) {
          values.add(this.#normalizeWeekday(value));
        }
      }
    }

    field.values = [...values].sort((a, b) => a - b);

    return field;
  }

  static #applyNames(raw: string, names: Record<string, number>): string {
    return raw.replace(/[A-Za-z]{3,}/g, (match) => {
      const value = names[match.toUpperCase()];

      if (value === undefined) {
        throw new Error(`Unknown name "${match}" in cron expression.`);
      }

      return String(value);
    });
  }

  static #normalizeWeekday(value: number): number {
    return value === 7 ? 0 : value;
  }

  static #range(min: number, max: number): number[] {
    const values: number[] = [];

    for (let value = min; value <= max; value++) {
      values.push(value);
    }

    return values;
  }
}
