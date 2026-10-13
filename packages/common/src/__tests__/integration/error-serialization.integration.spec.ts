import "reflect-metadata";
import { BytiumException, ValidationException } from "@core";
import { deserializeError, serializeError } from "@citizenfx/utils/error-serialization.utils";

describe("serializeError", () => {
  let originalGetConvar: typeof GetConvar;

  beforeEach(() => {
    originalGetConvar = global.GetConvar;
  });

  afterEach(() => {
    global.GetConvar = originalGetConvar;
  });

  const enableDevMode = (): void => {
    global.GetConvar = ((key: string, defaultValue: string) =>
      key.endsWith(":bytium-core:devMode") ? "true" : defaultValue) as typeof GetConvar;
  };

  describe("in production (default)", () => {
    it("should pass a BytiumException's name, message and code through unchanged", () => {
      const bytiumExceptionInstance = new BytiumException("ace already exists", "ACE_ALREADY_EXISTS");
      const { __bytiumError: payload } = serializeError(bytiumExceptionInstance);

      expect(payload.__isErrorInstance).toBe(true);
      expect(payload.name).toBe("BytiumException");
      expect(payload.message).toBe("ace already exists");
      expect(payload.code).toBe("ACE_ALREADY_EXISTS");
    });

    it("should not leak a BytiumException's stack or extra properties", () => {
      const bytiumExceptionInstance = new BytiumException("player not found", "INVALID_PLAYER");

      Reflect.set(bytiumExceptionInstance, "query", "SELECT * FROM players");
      const { __bytiumError: payload } = serializeError(bytiumExceptionInstance);

      expect(payload.stack).toBeUndefined();
      expect(payload.query).toBeUndefined();
    });

    it("should include a ValidationException's per-field errors", () => {
      const validationExceptionInstance = new ValidationException({ name: ["required"], age: ["must be a number"] });
      const { __bytiumError: payload } = serializeError(validationExceptionInstance);

      expect(payload.name).toBe("ValidationException");
      expect(payload.message).toBe("Validation failed");
      expect(payload.code).toBe(400);
      expect(payload.errors).toEqual({ name: ["required"], age: ["must be a number"] });
    });

    it("should omit errors for a BytiumException that carries none", () => {
      const bytiumExceptionInstance = new BytiumException("player not found", "INVALID_PLAYER");
      const { __bytiumError: payload } = serializeError(bytiumExceptionInstance);

      expect(payload.errors).toBeUndefined();
    });

    it("should sanitize an unexpected error into a generic 500", () => {
      const { __bytiumError: payload } = serializeError(new TypeError("cannot read property of undefined"));

      expect(payload.__isErrorInstance).toBe(true);
      expect(payload.name).toBe("InternalError");
      expect(payload.message).toBe("Internal server error");
      expect(payload.code).toBe(500);
      expect(payload.stack).toBeUndefined();
    });

    it("should sanitize a thrown non-error value into a generic 500", () => {
      const { __bytiumError: payload } = serializeError("raw secret string");

      expect(payload.name).toBe("InternalError");
      expect(payload.message).toBe("Internal server error");
      expect(payload.code).toBe(500);
    });
  });

  describe("in dev mode", () => {
    beforeEach(() => enableDevMode());

    it("should expose an unexpected error's real name, message and stack", () => {
      const { __bytiumError: payload } = serializeError(new TypeError("cannot read property of undefined"));

      expect(payload.__isErrorInstance).toBe(true);
      expect(payload.name).toBe("TypeError");
      expect(payload.message).toBe("cannot read property of undefined");
      expect(payload.stack).toBeDefined();
    });

    it("should expose a BytiumException's stack and extra properties", () => {
      const bytiumExceptionInstance = new BytiumException("player not found", "INVALID_PLAYER");

      Reflect.set(bytiumExceptionInstance, "query", "SELECT * FROM players");
      const { __bytiumError: payload } = serializeError(bytiumExceptionInstance);

      expect(payload.message).toBe("player not found");
      expect(payload.code).toBe("INVALID_PLAYER");
      expect(payload.stack).toBeDefined();
      expect(payload.query).toBe("SELECT * FROM players");
    });

    it("should pass a thrown non-error value through as its raw value", () => {
      const { __bytiumError: payload } = serializeError("raw value");

      expect(payload.__isErrorInstance).toBe(false);
      expect(payload.value).toBe("raw value");
    });
  });
  describe("deserializeError", () => {
    it("should rebuild a serialized BytiumException with its code and errors", () => {
      const serialized = serializeError(new BytiumException("denied", 403, { principal: ["Principal is required."] }));
      const deserialized = deserializeError(serialized);

      expect(deserialized).toBeInstanceOf(BytiumException);
      expect((deserialized as BytiumException).code).toBe(403);
      expect((deserialized as BytiumException).errors).toEqual({ principal: ["Principal is required."] });
    });

    it("should rebuild the sanitized internal error as a BytiumException with code 500", () => {
      const deserialized = deserializeError(serializeError(new TypeError("boom")));

      expect(deserialized).toBeInstanceOf(BytiumException);
      expect((deserialized as BytiumException).code).toBe(500);
    });

    it("should keep a dev-mode error with a string code a plain Error and preserve the code", () => {
      enableDevMode();

      const systemError = new Error("ENOENT: no such file or directory");

      Reflect.set(systemError, "code", "ENOENT");

      const deserialized = deserializeError(serializeError(systemError));

      expect(deserialized).toBeInstanceOf(Error);
      expect(deserialized).not.toBeInstanceOf(BytiumException);
      expect(Reflect.get(deserialized as Error, "code")).toBe("ENOENT");
    });

    it("should never serialize the cause in production", () => {
      const wrapped = new BytiumException("Failed to add ACE", 500, undefined, { cause: new Error("db exploded") });
      const { __bytiumError: payload } = serializeError(wrapped);

      expect(JSON.stringify(payload)).not.toContain("db exploded");
    });

    it("should include the cause chain in dev mode", () => {
      enableDevMode();

      const wrapped = new BytiumException("Failed to add ACE", 500, undefined, { cause: new TypeError("db exploded") });
      const { __bytiumError: payload } = serializeError(wrapped);

      expect(payload.cause).toEqual(expect.objectContaining({ name: "TypeError", message: "db exploded" }));
    });

    it("should keep a serialized BytiumException identity across a second boundary", () => {
      const once = deserializeError(serializeError(new BytiumException("denied", 403)));
      const twice = deserializeError(serializeError(once));

      expect(twice).toBeInstanceOf(BytiumException);
      expect((twice as BytiumException).code).toBe(403);
    });
  });
});
