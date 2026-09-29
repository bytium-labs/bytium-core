import { DefaultValuePipe, ParseArrayPipe, ParseEnumPipe, ParseUUIDPipe } from "@core";

enum Role {
  Admin = "admin",
  User = "user",
}

describe("DefaultValuePipe", () => {
  it("should substitute the fallback for null or undefined and pass every other value through", () => {
    const pipe = new DefaultValuePipe("fallback");

    expect(pipe.transform(undefined)).toBe("fallback");
    expect(pipe.transform(null)).toBe("fallback");
    expect(pipe.transform("value")).toBe("value");
    expect(pipe.transform(0)).toBe(0);
    expect(pipe.transform("")).toBe("");
  });
});

describe("ParseUUIDPipe", () => {
  it("should return a valid UUID unchanged", () => {
    const pipe = new ParseUUIDPipe();

    expect(pipe.transform("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  });

  it("should throw for a value that is not a UUID", () => {
    const pipe = new ParseUUIDPipe();

    expect(() => pipe.transform("not-a-uuid")).toThrow("Expected a UUID");
  });
});

describe("ParseEnumPipe", () => {
  it("should return a value that belongs to the enum", () => {
    const pipe = new ParseEnumPipe(Role);

    expect(pipe.transform("admin")).toBe("admin");
  });

  it("should throw for a value outside the enum", () => {
    const pipe = new ParseEnumPipe(Role);

    expect(() => pipe.transform("root")).toThrow("Expected one of");
  });
});

describe("ParseArrayPipe", () => {
  it("should split a delimited string into an array and pass an existing array through", () => {
    const pipe = new ParseArrayPipe();

    expect(pipe.transform("a,b,c")).toEqual(["a", "b", "c"]);
    expect(pipe.transform(["x", "y"])).toEqual(["x", "y"]);
  });

  it("should honor a custom separator", () => {
    const pipe = new ParseArrayPipe({ separator: "|" });

    expect(pipe.transform("a|b")).toEqual(["a", "b"]);
  });
});
