import { StandardSchemaV1 } from "@core/interfaces/standard-schema.interface";
import { sensitive } from "@core/utils/sensitive-schema.utils";
import { SENSITIVE_SCHEMA_PATHS } from "@shared/consts/sensitive-schema-paths.const";

describe("sensitive schema wrapper", () => {
  const declareSchema = (): StandardSchemaV1 => ({
    "~standard": {
      version: 1,
      vendor: "test",
      validate: jest.fn((value: unknown) => ({ value })),
    },
  });

  it("should carry the masked paths on the wrapper", () => {
    const wrapped = sensitive(declareSchema(), ["password", "credentials.token"]);

    expect(Reflect.get(wrapped, SENSITIVE_SCHEMA_PATHS)).toEqual(["password", "credentials.token"]);
  });

  it("should leave the original schema untouched", () => {
    const schema = declareSchema();

    sensitive(schema, ["password"]);

    expect(Reflect.get(schema, SENSITIVE_SCHEMA_PATHS)).toBeUndefined();
  });

  it("should keep the vendor and the whole standard props of the original", () => {
    const schema = declareSchema();
    const wrapped = sensitive(schema, ["password"]);

    expect(wrapped["~standard"]).toBe(schema["~standard"]);
    expect(wrapped["~standard"].vendor).toBe("test");
  });

  it("should type-check the paths against the schema output", () => {
    const typedSchema = declareSchema() as StandardSchemaV1<
      unknown,
      { login: string; credentials: { token: string }; items: { secret: string }[] }
    >;
    const wrapped = sensitive(typedSchema, ["login", "credentials.token", "items.*", "items.*.secret"]);

    // @ts-expect-error unknown path must not compile
    sensitive(typedSchema, ["loggin"]);
    // @ts-expect-error unknown path must not compile
    sensitive(typedSchema, ["credentials.tokenn"]);

    expect(Reflect.get(wrapped, SENSITIVE_SCHEMA_PATHS)).toEqual([
      "login",
      "credentials.token",
      "items.*",
      "items.*.secret",
    ]);
  });

  it("should keep a callable schema callable", () => {
    const callableSchema = Object.assign((value: unknown) => value, {
      "~standard": { version: 1 as const, vendor: "arktype", validate: (value: unknown) => ({ value }) },
    });
    const wrapped = sensitive(callableSchema as unknown as StandardSchemaV1, ["password"]);

    expect((wrapped as unknown as (value: unknown) => unknown)({ ok: 1 })).toEqual({ ok: 1 });
    expect(Reflect.get(wrapped, SENSITIVE_SCHEMA_PATHS)).toEqual(["password"]);
    expect("~standard" in wrapped).toBe(true);
  });

  it("should stay a standard schema and delegate validation to the original", async () => {
    const schema = declareSchema();
    const wrapped = sensitive(schema, ["password"]);

    expect("~standard" in wrapped).toBe(true);

    const result = await wrapped["~standard"].validate({ login: "lilabyte" });

    expect(result).toEqual({ value: { login: "lilabyte" } });

    expect(schema["~standard"].validate).toHaveBeenCalledWith({ login: "lilabyte" });
  });
});
