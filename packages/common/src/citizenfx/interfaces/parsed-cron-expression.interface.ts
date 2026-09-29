export interface ParsedCronExpression {
  minutes: number[];
  hours: number[];
  months: number[];
  daysOfMonth: {
    values: number[];
    last: boolean;
    lastWeekday: boolean;
    nearestWeekday: number[];
  };
  daysOfWeek: {
    values: number[];
    lastOf: number[];
    nth: { dayOfWeek: number; occurrence: number }[];
  };
  dayOfMonthRestricted: boolean;
  dayOfWeekRestricted: boolean;
}
