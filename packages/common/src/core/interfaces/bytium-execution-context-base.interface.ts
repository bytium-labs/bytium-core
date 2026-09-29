/**
 * Fields present on every execution context, regardless of invocation surface.
 */
export interface BytiumExecutionContextBase {
  provider: object;
  methodName: string;
}
