import { CommandOptions as ServerCommandOptions } from "@citizenfx/decorators/server/command.decorator";
import { CommandOptions as ClientCommandOptions } from "@citizenfx/decorators/client/command.decorator";
import { CitizenFXRegisteredCommandInterface } from "@citizenfx/interfaces/citizenfx-registered-command.interface";
import { RegisteredCommandModel } from "@citizenfx/models/registered-command";
import { CommandNotAllowedFromConsoleException } from "@citizenfx/exceptions/command-not-allowed-from-console.exception";
import { CommandNotAllowedForPlayersException } from "@citizenfx/exceptions/command-not-allowed-for-players.exception";
import { CommandNameInvalidException } from "@citizenfx/exceptions/command-name-invalid.exception";
import { CommandAlreadyRegisteredException } from "@citizenfx/exceptions/command-already-registered.exception";
import { HandlerInvoker } from "@core/invokers/handler.invoker";
import { Logger } from "@logger";
import { ConstructorType } from "@shared";

export class CommandsRegistry {
  readonly #logger = new Logger("bytium");
  readonly #isCitizenFXServer = IsDuplicityVersion();
  readonly #commandsWithSuggestionsByName = new Map<string, RegisteredCommandModel>();

  #createCommandHandleWrapper(
    instance: object,
    methodName: string,
    options: ServerCommandOptions | ClientCommandOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): (source: number, args: string[], rawCommand: string) => void {
    const commandHandleWrapper = async (source: number, args: string[], rawCommand: string) => {
      try {
        this.#logger.debug(
          `Received command "${options.name}" from source "${source}" (typeof source: ${typeof source})`,
        );

        if (this.#isCitizenFXServer) {
          if (!(options as ServerCommandOptions).canBeUsedByServer && Number(source) <= 0) {
            throw new CommandNotAllowedFromConsoleException("This command cannot be executed from the server console.");
          }

          if (!(options as ServerCommandOptions).canBeUsedByPlayers && Number(source) > 0) {
            throw new CommandNotAllowedForPlayersException("This command cannot be executed by players.");
          }
        }

        const context = { type: "COMMAND", provider: instance, methodName, source, args, rawCommand };

        await handlerInvoker.invoke(context);
      } catch (err) {
        this.#logger.error(`Error while handling @Command on method ${methodName} in provider ${provider.name}:`, err);
      }
    };

    return commandHandleWrapper;
  }

  registerCommand(
    instance: object,
    methodName: string,
    options: ServerCommandOptions | ClientCommandOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    try {
      const commandName = options.name.trim();
      const commandAliases = options.aliases?.length
        ? options.aliases.map((alias) => alias.trim()).filter((alias) => !!alias)
        : [];
      const commandNamesToRegister = [commandName, ...commandAliases];

      if (!commandName) {
        throw new CommandNameInvalidException("Command name cannot be empty.");
      }

      const globalRegisteredCommands: CitizenFXRegisteredCommandInterface[] = GetRegisteredCommands();
      const alreadyRegisteredCommand = globalRegisteredCommands.find((command) =>
        commandNamesToRegister.includes(command.name),
      );

      if (alreadyRegisteredCommand) {
        throw new CommandAlreadyRegisteredException(
          `Command with name ${alreadyRegisteredCommand.name} is already registered in resource ${alreadyRegisteredCommand.resource}.`,
        );
      }

      const commandHandleWrapper = this.#createCommandHandleWrapper(
        instance,
        methodName,
        options,
        provider,
        handlerInvoker,
      );

      for (const commandName of commandNamesToRegister) {
        RegisterCommand(commandName, commandHandleWrapper, (options as ServerCommandOptions).isRestricted ?? false);

        if (options.help || options.suggestions?.length) {
          this.#commandsWithSuggestionsByName.set(
            commandName,
            new RegisteredCommandModel(commandName, options, provider, methodName),
          );
        }
      }
    } catch (err) {
      this.#logger.error(
        `Couldn't register @Command on method ${methodName} in provider ${provider.name}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err,
      );
    }
  }

  getCommandsWithSuggestions(): RegisteredCommandModel[] {
    return Array.from(this.#commandsWithSuggestionsByName.values());
  }
}
