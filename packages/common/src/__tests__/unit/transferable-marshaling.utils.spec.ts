import { BytiumException } from "@core/exceptions/bytium.exception";
import { InvocationContextInterface } from "@invocation/interfaces/invocation-context.interface";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";
import { wrapTransferableForConsumer, wrapTransferableForOwner } from "@citizenfx/utils/transferable-marshaling.utils";

describe("transferable error marshaling", () => {
  let originalIsDuplicityVersion: unknown;

  beforeAll(() => {
    originalIsDuplicityVersion = (global as any).IsDuplicityVersion;
    (global as any).IsDuplicityVersion = () => true;
  });

  afterAll(() => {
    (global as any).IsDuplicityVersion = originalIsDuplicityVersion;
  });

  class Facade {
    __ownerResourceName = "owner-resource";

    greet(name: string): string {
      return `hi ${name}`;
    }

    reject(): never {
      throw new BytiumException("ACE is owned by another resource", 403);
    }

    async rejectAsync(): Promise<never> {
      throw new BytiumException("async ownership denial", 403);
    }

    async resolveAsync(): Promise<string> {
      return "async-ok";
    }
  }

  const transfer = <T extends object>(instance: T): T =>
    wrapTransferableForConsumer(wrapTransferableForOwner(instance));

  it("passes a successful return value through unchanged", () => {
    const facade = transfer(new Facade());

    expect(facade.greet("bob")).toBe("hi bob");
  });

  it("exposes a non-function property unchanged", () => {
    const facade = transfer(new Facade());

    expect(facade.__ownerResourceName).toBe("owner-resource");
  });

  it("rethrows a BytiumException on the consumer side, preserving message and code", () => {
    const facade = transfer(new Facade());
    let caught: unknown;

    try {
      facade.reject();
    } catch (error) {
      caught = error;
    }

    expect((caught as Error).message).toBe("ACE is owned by another resource");
    expect((caught as { code?: number }).code).toBe(403);
  });

  it("rethrows across an async boundary", async () => {
    const facade = transfer(new Facade());

    await expect(facade.rejectAsync()).rejects.toThrow("async ownership denial");
  });

  it("passes an async success through", async () => {
    const facade = transfer(new Facade());

    await expect(facade.resolveAsync()).resolves.toBe("async-ok");
  });

  it("does not wrap plain data returned from a method", () => {
    class DataFacade {
      __ownerResourceName = "owner-resource";

      getData(): { x: number } {
        return { x: 1 };
      }
    }

    const facade = transfer(new DataFacade());

    expect(facade.getData()).toEqual({ x: 1 });
  });

  it("should return the same wrapper for repeated reads of the same method", () => {
    const facade = transfer(new Facade());

    expect(facade.greet).toBe(facade.greet);
  });

  it("should run a #private-backed getter against the real instance", () => {
    class GetterFacade {
      __ownerResourceName = "owner-resource";
      #secret = "secret-ok";

      get secret(): string {
        return this.#secret;
      }
    }

    const facade = transfer(new GetterFacade());

    expect(facade.secret).toBe("secret-ok");
  });

  describe("nested transferable returned from a method", () => {
    class Nested {
      __ownerResourceName = "owner-resource";

      value(): string {
        return "nested-ok";
      }

      reject(): never {
        throw new BytiumException("nested denial", 403);
      }
    }

    class ParentFacade {
      __ownerResourceName = "owner-resource";

      getNested(): Nested {
        return new Nested();
      }
    }

    it("passes a nested method's value through", () => {
      const facade = transfer(new ParentFacade());

      expect(facade.getNested().value()).toBe("nested-ok");
    });

    it("rethrows an error from a nested transferable's method", () => {
      const facade = transfer(new ParentFacade());
      const nested = facade.getNested();

      expect(() => nested.reject()).toThrow("nested denial");
      expect(() => nested.reject()).toThrow(expect.objectContaining({ code: 403 }));
    });
  });

  describe("transferable passed as an argument (reversed ownership)", () => {
    class ArgProvider {
      __ownerResourceName = "arg-owner-resource";

      reject(): never {
        throw new BytiumException("arg provider denial", 403);
      }

      value(): string {
        return "arg-ok";
      }
    }

    class Registry {
      __ownerResourceName = "owner-resource";

      #held: ArgProvider | undefined;

      register(provider: ArgProvider): void {
        this.#held = provider;
      }

      callHeldValue(): string {
        return this.#held!.value();
      }

      callHeldReject(): void {
        this.#held!.reject();
      }
    }

    it("rethrows an error when the owner calls a method on an argument-passed transferable", () => {
      const registry = transfer(new Registry());

      registry.register(new ArgProvider());

      expect(() => registry.callHeldReject()).toThrow("arg provider denial");
    });

    it("passes a value when the owner calls a method on an argument-passed transferable", () => {
      const registry = transfer(new Registry());

      registry.register(new ArgProvider());

      expect(registry.callHeldValue()).toBe("arg-ok");
    });
  });

  describe("correlation across the boundary", () => {
    class CtxFacade {
      __ownerResourceName = "owner-resource";

      whoAmI(): InvocationContextInterface | undefined {
        return invocationContextManagerInstance.getContext();
      }

      async whoAmIAfterAwait(): Promise<InvocationContextInterface | undefined> {
        await new Promise((resolve) => setTimeout(resolve, 5));

        return invocationContextManagerInstance.getContext();
      }

      echo(...args: unknown[]): unknown[] {
        return args;
      }
    }

    it("should inherit the caller's correlationId on the owner side", () => {
      const facade = transfer(new CtxFacade());
      let ownerContext: InvocationContextInterface | undefined;

      invocationContextManagerInstance.run(
        () => ({ correlationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f", type: "COMMAND", handler: "TestCommand.run" }),
        () => {
          ownerContext = facade.whoAmI();
        },
      );

      expect(ownerContext?.correlationId).toBe("0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f");
      expect(ownerContext?.type).toBe("TRANSFERABLE");
      expect(ownerContext?.handler).toBe("CtxFacade.whoAmI");
      expect(ownerContext?.invokedBy).toBe("invoking-resource");
    });

    it("should keep the inherited context across the method's await", async () => {
      const facade = transfer(new CtxFacade());
      const ownerContext = await invocationContextManagerInstance.run(
        () => ({ correlationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f", type: "COMMAND", handler: "TestCommand.run" }),
        () => facade.whoAmIAfterAwait(),
      );

      expect(ownerContext?.correlationId).toBe("0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f");
    });

    it("should establish a fresh context when the caller has none", () => {
      const facade = transfer(new CtxFacade());
      const ownerContext = facade.whoAmI();

      expect(ownerContext?.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(ownerContext?.invokedBy).toBe("invoking-resource");
    });

    it("should strip the envelope before the method sees its arguments", () => {
      const facade = transfer(new CtxFacade());
      let received: unknown[] = [];

      invocationContextManagerInstance.run(
        () => ({ correlationId: "0c6f1f3e-5b7a-4d2c-9e8f-3a1b2c4d5e6f", type: "COMMAND", handler: "TestCommand.run" }),
        () => {
          received = facade.echo(1, "two");
        },
      );

      expect(received).toEqual([1, "two"]);
    });
  });
});
