import "reflect-metadata";
import { StandardSchemaV1, ValidationException, ValidationPipe } from "@core";

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
