import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@OnConsoleOutput()`.
 */
export class OnConsoleOutputOptions {
  /** Console output channel. */
  channel: string;

  /**
   * Run the handler synchronously in the same task as the event dispatch - required when the handler
   * must apply effects before control returns to the runtime (e.g. `CancelEvent()`). See `@OnEvent`
   * for details and constraints (guards/params/pipes must be synchronous).
   */
  sync?: boolean;
}

/**
 * Registers a console output handler.
 *
 * @param channel Console output channel.
 *
 * @remarks Server-side only.
 */
export function OnConsoleOutput(channel: string): MethodDecorator;
/**
 * Registers a console output handler.
 *
 * @param options \@OnConsoleOutput() decorator options.
 *
 * @remarks Server-side only.
 */
export function OnConsoleOutput(options: OnConsoleOutputOptions): MethodDecorator;
export function OnConsoleOutput(a: string | OnConsoleOutputOptions): MethodDecorator {
  const onConsoleOutputOptions = new OnConsoleOutputOptions();

  Object.assign(onConsoleOutputOptions, typeof a === "string" ? { channel: a } : a);

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.ON_CONSOLE_OUTPUT, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, onConsoleOutputOptions, target, propertyKey);
  };
}
