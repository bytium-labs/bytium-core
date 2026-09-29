import "reflect-metadata";
import { Reflector, SetMetadata } from "@core";

describe("SetMetadata", () => {
  const reflector = new Reflector();

  it("should stamp metadata on a class constructor when used as a class decorator", () => {
    const METADATA_KEY = Symbol("set-metadata-test:class");

    @SetMetadata(METADATA_KEY, "class-value")
    class DependencyProviderA {}

    const readValue = reflector.get<string>(METADATA_KEY, DependencyProviderA);

    expect(readValue).toBe("class-value");
  });

  it("should stamp metadata on the prototype method when used as a method decorator", () => {
    const METADATA_KEY = Symbol("set-metadata-test:method");

    class DependencyProviderA {
      @SetMetadata(METADATA_KEY, "method-value")
      someMethod() {}
    }

    const readValue = reflector.get<string>(METADATA_KEY, DependencyProviderA.prototype, "someMethod");

    expect(readValue).toBe("method-value");
  });

  it("should stamp metadata on the prototype property when used as a property decorator", () => {
    const METADATA_KEY = Symbol("set-metadata-test:property");

    class DependencyProviderA {
      @SetMetadata(METADATA_KEY, "property-value")
      someProperty!: string;
    }

    const readValue = reflector.get<string>(METADATA_KEY, DependencyProviderA.prototype, "someProperty");

    expect(readValue).toBe("property-value");
  });

  it("should preserve the value reference so non-primitive metadata reads back identically", () => {
    const METADATA_KEY = Symbol("set-metadata-test:object");
    const metadataValue = { perMinute: 5, scope: "global" };

    @SetMetadata(METADATA_KEY, metadataValue)
    class DependencyProviderA {}

    const readValue = reflector.get<typeof metadataValue>(METADATA_KEY, DependencyProviderA);

    expect(readValue).toBe(metadataValue);
  });
});
