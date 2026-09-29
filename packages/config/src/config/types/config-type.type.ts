/**
 * Inferred shape of a namespaced config factory's payload.
 */
export type ConfigType<F extends (...args: any[]) => any> = ReturnType<F> extends { [k: string]: infer V } ? V : never;
