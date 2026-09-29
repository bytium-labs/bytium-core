import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@Tick()`.
 */
export class TickOptions {
  /**
   * Tick interval in milliseconds. 0 runs the handler every tick.
   *
   * @default 0
   */
  interval?: number = 0;

  /**
   * Whether to start the tick immediately after registration.
   *
   * @default true
   */
  autoStart?: boolean = true;
}

/**
 * Registers a tick handler.
 *
 * @param interval Tick interval in milliseconds; 0 runs every tick.
 * @param options \@Tick() decorator options.
 */
export function Tick(interval?: number, options?: Omit<TickOptions, "interval">): MethodDecorator;
/**
 * Registers a tick handler.
 *
 * @param options \@Tick() decorator options.
 */
export function Tick(options?: TickOptions): MethodDecorator;
export function Tick(a?: number | TickOptions, b?: Omit<TickOptions, "interval">): MethodDecorator {
  const tickOptions = new TickOptions();

  Object.assign(tickOptions, typeof a === "number" ? { interval: a, ...(b as TickOptions) } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.TICK, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, tickOptions, target, propertyKey);
  };
}
