/**
 * Correlation metadata of the handler invocation a log line was emitted from.
 */
export interface InvocationContextInterface {
  /** Identifier shared by every log line of one handler invocation (UUID v4). */
  correlationId: string;

  /** Kind of the invoked handler (command, event, callback, ...). */
  type: string;

  /** Provider class and method of the invoked handler. */
  handler: string;

  /** Server id of the player that triggered the invocation, when there is one. */
  source?: number;

  /** Name of the resource that called the Transferable method, for cross-resource invocations. */
  invokedBy?: string;
}
