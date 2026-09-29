import { CommandOptions as ServerCommandOptions } from "@citizenfx/decorators/server/command.decorator";
import { CommandOptions as ClientCommandOptions } from "@citizenfx/decorators/client/command.decorator";
import { ConstructorType } from "@shared";

export class RegisteredCommandModel {
  constructor(
    public readonly name: string,
    public readonly options: ServerCommandOptions | ClientCommandOptions,
    public readonly provider: ConstructorType,
    public readonly methodName: string,
  ) {}
}
