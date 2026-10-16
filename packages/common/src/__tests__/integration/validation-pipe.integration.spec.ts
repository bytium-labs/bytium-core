import "reflect-metadata";
import { sensitive, StandardSchemaV1, ValidationException, ValidationPipe } from "@core";
import { LOG_MASKED_ERRORS } from "@shared/consts/log-masked-errors.const";

describe("ValidationPipe", () => {
  const passingSchema: StandardSchemaV1<unknown, { name: string }> = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => ({ value: value as { name: string } }),
    },
  };
  const failingSchema: StandardSchemaV1 = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: () => ({
        issues: [
          { message: "is required", path: ["name"] },
          { message: "must be a number", path: [{ key: "age" }] },
        ],
      }),
    },
  };

  it("should keep full issue messages in the response and attach a value-scrubbed copy for logs", async () => {
    const maskedSchema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({
          issues: [
            { message: 'Invalid format: Expected /x/ but received "hunter2"', path: ["password"] },
            { message: 'Expected string but received "secret"', path: ["credentials", 0, "token"] },
            { message: "must be at least 3 characters", path: ["login"] },
          ],
        }),
      },
    };
    const validationPipeInstance = new ValidationPipe(sensitive(maskedSchema, ["password", "credentials.*.token"]));
    const input = { password: "hunter2", credentials: [{ token: "secret" }], login: "ab" };
    const thrown = (await validationPipeInstance.transform(input).catch((error) => error)) as ValidationException;

    expect(thrown.errors).toEqual({
      password: ['Invalid format: Expected /x/ but received "hunter2"'],
      "credentials.0.token": ['Expected string but received "secret"'],
      login: ["must be at least 3 characters"],
    });

    expect(Reflect.get(thrown, LOG_MASKED_ERRORS)).toEqual({
      password: ['Invalid format: Expected /x/ but received "[REDACTED]"'],
      "credentials.0.token": ['Expected string but received "[REDACTED]"'],
      login: ["must be at least 3 characters"],
    });
    expect(Object.keys(thrown)).not.toContain(LOG_MASKED_ERRORS);
  });

  it("should keep a clean message of a masked field when it does not embed the value", async () => {
    const maskedSchema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({
          issues: [{ message: "String must contain at least 8 character(s)", path: ["password"] }],
        }),
      },
    };
    const validationPipeInstance = new ValidationPipe(sensitive(maskedSchema, ["password"]));
    const thrown = (await validationPipeInstance
      .transform({ password: "hunter2" })
      .catch((error) => error)) as ValidationException;

    expect(Reflect.get(thrown, LOG_MASKED_ERRORS)).toEqual({
      password: ["String must contain at least 8 character(s)"],
    });
  });

  it("should redact the whole message when the masked value collides with the message's own words", async () => {
    const maskedSchema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({
          issues: [{ message: 'Invalid format: Expected /x/ but received "received"', path: ["password"] }],
        }),
      },
    };
    const validationPipeInstance = new ValidationPipe(sensitive(maskedSchema, ["password"]));
    const thrown = (await validationPipeInstance
      .transform({ password: "received" })
      .catch((error) => error)) as ValidationException;

    expect(Reflect.get(thrown, LOG_MASKED_ERRORS)).toEqual({ password: ["[REDACTED]"] });
  });

  it("should redact the whole message when a non-string masked value appears in it", async () => {
    const maskedSchema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({
          issues: [{ message: "Invalid value: Expected <4096 but received 1234", path: ["pin"] }],
        }),
      },
    };
    const validationPipeInstance = new ValidationPipe(sensitive(maskedSchema, ["pin"]));
    const thrown = (await validationPipeInstance
      .transform({ pin: 1234 })
      .catch((error) => error)) as ValidationException;

    expect(Reflect.get(thrown, LOG_MASKED_ERRORS)).toEqual({ pin: ["[REDACTED]"] });
  });

  it("should redact the whole message when the masked value is too short to scrub safely", async () => {
    const maskedSchema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({
          issues: [{ message: "Invalid digit: Expected 4 digits but received 7", path: ["pin"] }],
        }),
      },
    };
    const validationPipeInstance = new ValidationPipe(sensitive(maskedSchema, ["pin"]));
    const thrown = (await validationPipeInstance.transform({ pin: 7 }).catch((error) => error)) as ValidationException;

    expect(Reflect.get(thrown, LOG_MASKED_ERRORS)).toEqual({ pin: ["[REDACTED]"] });
  });

  it("should return the parsed value when the schema passes", async () => {
    const validationPipeInstance = new ValidationPipe(passingSchema);
    const input = { name: "Alice" };

    await expect(validationPipeInstance.transform(input)).resolves.toBe(input);
  });

  it("should throw a ValidationException with per-field errors when the schema fails", async () => {
    const validationPipeInstance = new ValidationPipe(failingSchema);
    const thrown = (await validationPipeInstance.transform({}).catch((error) => error)) as ValidationException;

    expect(thrown).toBeInstanceOf(ValidationException);
    expect(thrown.code).toBe(400);
    expect(thrown.errors).toEqual({ name: ["is required"], age: ["must be a number"] });
  });

  it("should group multiple messages for the same field", async () => {
    const multiIssueSchema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({
          issues: [
            { message: "is required", path: ["name"] },
            { message: "must be longer than 3", path: ["name"] },
          ],
        }),
      },
    };
    const validationPipeInstance = new ValidationPipe(multiIssueSchema);
    const thrown = (await validationPipeInstance.transform({}).catch((error) => error)) as ValidationException;

    expect(thrown.errors).toEqual({ name: ["is required", "must be longer than 3"] });
  });

  it("should await an async schema before deciding the outcome", async () => {
    const asyncSchema: StandardSchemaV1<unknown, number> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (value) => Promise.resolve({ value: value as number }),
      },
    };
    const validationPipeInstance = new ValidationPipe(asyncSchema);

    await expect(validationPipeInstance.transform(42)).resolves.toBe(42);
  });

  it('should key a root-level issue without a path under "_"', async () => {
    const rootIssueSchema: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({ issues: [{ message: "invalid payload" }] }),
      },
    };
    const validationPipeInstance = new ValidationPipe(rootIssueSchema);
    const thrown = (await validationPipeInstance.transform(null).catch((error) => error)) as ValidationException;

    expect(thrown.errors).toEqual({ _: ["invalid payload"] });
  });
});
