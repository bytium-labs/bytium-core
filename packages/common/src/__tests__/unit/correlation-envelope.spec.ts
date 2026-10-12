import { appendCorrelationEnvelope, extractCorrelationEnvelope } from "@citizenfx/utils/correlation-envelope.utils";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";

describe("correlation envelope", () => {
  let originalIsDuplicityVersion: unknown;

  beforeAll(() => {
    originalIsDuplicityVersion = (global as any).IsDuplicityVersion;
    (global as any).IsDuplicityVersion = () => true;
  });

  afterAll(() => {
    (global as any).IsDuplicityVersion = originalIsDuplicityVersion;
  });

  it("should append the envelope as the last argument when an invocation context is active", () => {
    let enveloped: unknown[] = [];

    invocationContextManagerInstance.run(
      () => ({ correlationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f", type: "COMMAND", handler: "TestCommand.run" }),
      () => {
        enveloped = appendCorrelationEnvelope([1, "two"]);
      },
    );

    expect(enveloped).toEqual([1, "two", { __bytiumCorrelationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f" }]);
  });

  it("should leave the arguments untouched when no invocation context is active", () => {
    expect(appendCorrelationEnvelope([1, "two"])).toEqual([1, "two"]);
  });

  it("should extract the correlationId and strip the envelope from the arguments", () => {
    const extracted = extractCorrelationEnvelope([
      1,
      "two",
      { __bytiumCorrelationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f" },
    ]);

    expect(extracted.args).toEqual([1, "two"]);
    expect(extracted.correlationId).toBe("0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f");
  });

  it("should pass the arguments through when the last argument is not an envelope", () => {
    const extracted = extractCorrelationEnvelope([1, { detail: "plain data" }]);

    expect(extracted.args).toEqual([1, { detail: "plain data" }]);
    expect(extracted.correlationId).toBeUndefined();
  });

  it("should pass an empty argument list through", () => {
    const extracted = extractCorrelationEnvelope([]);

    expect(extracted.args).toEqual([]);
    expect(extracted.correlationId).toBeUndefined();
  });
});
