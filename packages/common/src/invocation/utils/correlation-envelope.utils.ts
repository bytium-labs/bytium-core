import { CORRELATION_ENVELOPE_KEY } from "@invocation/consts/correlation-envelope-key.const";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";

export function appendCorrelationEnvelope(args: unknown[]): unknown[] {
  const context = invocationContextManagerInstance.getContext();

  return context ? [...args, { [CORRELATION_ENVELOPE_KEY]: context.correlationId }] : args;
}

export function extractCorrelationEnvelope(args: unknown[]): { args: unknown[]; correlationId?: string } {
  const last = args[args.length - 1];

  if (last !== null && typeof last === "object" && CORRELATION_ENVELOPE_KEY in last) {
    const correlationId = Reflect.get(last, CORRELATION_ENVELOPE_KEY) as unknown;

    if (typeof correlationId === "string") {
      return { args: args.slice(0, -1), correlationId };
    }
  }

  return { args };
}
