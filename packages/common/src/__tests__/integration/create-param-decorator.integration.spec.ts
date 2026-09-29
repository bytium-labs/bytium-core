import "reflect-metadata";
import { HandlerInvoker } from "@core";
import { AnyExecutionContext } from "@core/types/any-execution-context.type";
import { createParamDecorator } from "@citizenfx/server";

describe("createParamDecorator", () => {
  const handlerInvoker = new HandlerInvoker();
  const CommandArgs = createParamDecorator((_data, context) => {
    if (context.type !== "COMMAND") throw new Error(`@CommandArgs() not available in "${context.type}" handlers.`);

    return context.args;
  });
  const Source = createParamDecorator((_data, context) => {
    if (context.type !== "COMMAND" && context.type !== "NET_CALLBACK" && context.type !== "ON_NET_EVENT") {
      throw new Error(`@Source() not available in "${context.type}" handlers.`);
    }

    return context.source;
  });
  const CommandArg = createParamDecorator((index: number, context) => {
    if (context.type !== "COMMAND") throw new Error(`@CommandArg() not available in "${context.type}" handlers.`);

    return context.args[index];
  });
  const buildCommandContext = (provider: object, source: number, args: string[]): AnyExecutionContext =>
    ({
      type: "COMMAND",
      provider,
      methodName: "handle",
      source,
      args,
      rawCommand: args.join(" "),
    }) as AnyExecutionContext;

  it("should resolve a parameter from the live execution context when the handler is invoked", async () => {
    class DependentProviderA {
      receivedArgs: string[] = [];

      handle(@CommandArgs() args: string[]) {
        this.receivedArgs = args;
      }
    }

    const dependentProviderAInstance = new DependentProviderA();

    await handlerInvoker.invoke(buildCommandContext(dependentProviderAInstance, 1, ["kick", "reason"]));

    expect(dependentProviderAInstance.receivedArgs).toEqual(["kick", "reason"]);
  });

  it("should resolve each decorated parameter regardless of its position in the signature", async () => {
    class DependentProviderA {
      receivedSource = -1;
      receivedArgs: string[] = [];

      handle(@Source() source: number, @CommandArgs() args: string[]) {
        this.receivedSource = source;
        this.receivedArgs = args;
      }
    }

    const dependentProviderAInstance = new DependentProviderA();

    await handlerInvoker.invoke(buildCommandContext(dependentProviderAInstance, 7, ["ban"]));

    expect(dependentProviderAInstance.receivedSource).toBe(7);
    expect(dependentProviderAInstance.receivedArgs).toEqual(["ban"]);
  });

  it("should pass the decorator's data argument through to the factory", async () => {
    class DependentProviderA {
      receivedFirstArg = "";

      handle(@CommandArg(0) firstArg: string) {
        this.receivedFirstArg = firstArg;
      }
    }

    const dependentProviderAInstance = new DependentProviderA();

    await handlerInvoker.invoke(buildCommandContext(dependentProviderAInstance, 1, ["teleport", "5"]));

    expect(dependentProviderAInstance.receivedFirstArg).toBe("teleport");
  });

  it("should throw from the factory when used on an incompatible surface", async () => {
    class DependentProviderA {
      handle(@CommandArgs() _args: string[]) {}
    }

    const dependentProviderAInstance = new DependentProviderA();
    const nonCommandContext = {
      type: "TICK",
      provider: dependentProviderAInstance,
      methodName: "handle",
    } as AnyExecutionContext;

    await expect(handlerInvoker.invoke(nonCommandContext)).rejects.toThrow(/@CommandArgs\(\) not available/);
  });
});
