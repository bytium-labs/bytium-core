import { CronOptions } from "@citizenfx/decorators/shared/cron.decorator";
import { ConstructorType } from "@shared";
import { ParsedCronExpression } from "@citizenfx/interfaces/parsed-cron-expression.interface";
import { parseCronExpression, getNextCronRun } from "@citizenfx/utils/cron.utils";

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
    this.#expression = parseCronExpression(options.expression);
    this.#timeZone = options.timezone;
    this.nextRun = getNextCronRun(this.#expression, new Date(), this.#timeZone);
  }

  isDue(): boolean {
    return Date.now() >= this.nextRun.getTime();
  }

  advanceNextRun(): void {
    this.nextRun = getNextCronRun(this.#expression, this.nextRun, this.#timeZone);
  }
}
