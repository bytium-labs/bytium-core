import { CronOptions } from "@citizenfx/decorators/shared/cron.decorator";
import { ConstructorType } from "@shared";
import { ParsedCronExpression } from "@citizenfx/interfaces/parsed-cron-expression.interface";
import { CronExpressionParser } from "@citizenfx/parsers/cron-expression.parser";
import { CronSchedule } from "@citizenfx/schedules/cron.schedule";

export class RegisteredCronJobModel {
  readonly #expression: ParsedCronExpression;
  readonly #timeZone?: string;
  nextRun: Date;

  constructor(
    public readonly handle: (...args: any[]) => Promise<void> | void,
    public readonly options: CronOptions,
    public readonly provider: ConstructorType,
    public readonly methodName: string,
  ) {
    this.#expression = CronExpressionParser.parse(options.expression);
    this.#timeZone = options.timezone;
    this.nextRun = CronSchedule.nextOccurrence(this.#expression, new Date(), this.#timeZone);
  }

  isDue(): boolean {
    return Date.now() >= this.nextRun.getTime();
  }

  advanceNextRun(): void {
    this.nextRun = CronSchedule.nextOccurrence(this.#expression, this.nextRun, this.#timeZone);
  }
}
