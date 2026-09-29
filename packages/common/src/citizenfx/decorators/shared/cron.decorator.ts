import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@Cron()`.
 */
export class CronOptions {
  /** Cron expression. */
  expression: string;

  /** IANA timezone the expression is evaluated in (e.g. "Europe/Warsaw"). Defaults to UTC. */
  timezone?: string;
}

/**
 * Registers a cron job.
 *
 * @param expression Cron expression.
 * @param timezone IANA timezone the expression runs in (e.g. "Europe/Warsaw"). Defaults to UTC.
 */
export function Cron(expression: string, timezone?: string): MethodDecorator;
/**
 * Registers a cron job.
 *
 * @param expression Cron expression.
 * @param options \@Cron() decorator options.
 */
export function Cron(expression: string, options?: Omit<CronOptions, "expression">): MethodDecorator;
/**
 * Registers a cron job.
 *
 * @param options \@Cron() decorator options.
 */
export function Cron(options: CronOptions): MethodDecorator;
export function Cron(a: string | CronOptions, b?: string | Omit<CronOptions, "expression">): MethodDecorator {
  const cronOptions = new CronOptions();

  if (typeof a === "string") {
    cronOptions.expression = a;

    if (typeof b === "string") {
      cronOptions.timezone = b;
    } else if (b) {
      Object.assign(cronOptions, b);
    }
  } else {
    Object.assign(cronOptions, a);
  }

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.CRON, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, cronOptions, target, propertyKey);
  };
}
