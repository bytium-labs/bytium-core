/**
 * A pipe transforms or validates a resolved handler argument before the handler runs.
 */
export interface PipeTransform<TInput = unknown, TOutput = unknown> {
  transform(value: TInput): TOutput | Promise<TOutput>;
}
