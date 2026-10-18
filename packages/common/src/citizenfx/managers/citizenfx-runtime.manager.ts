import { stringifySource } from "@citizenfx/utils/source.utils";
import { CronJobsRegistry } from "@citizenfx/registries/cron-jobs.registry";
import { CommandsRegistry } from "@citizenfx/registries/commands.registry";
import { Logger } from "@logger";
import { sleep } from "@shared";
import { CommandSuggestionInterface } from "@citizenfx/interfaces/command-suggestion.interface";
import { RegisteredCommandModel } from "@citizenfx/models/registered-command";

export class CitizenFXRuntimeManager {
  readonly #logger = new Logger("bytium-core");
  readonly #isCitizenFXServer = IsDuplicityVersion();
  #cronTickId?: number;

  constructor(
    private readonly cronJobsRegistry: CronJobsRegistry,
    private readonly commandsRegistry: CommandsRegistry,
  ) {}

  #getSuggestionsForPlayer(
    commandsWithSuggestions: RegisteredCommandModel[],
    source?: string,
  ): CommandSuggestionInterface[] {
    return commandsWithSuggestions
      .filter(
        ({ name }) => (!source && !this.#isCitizenFXServer) || IsPlayerAceAllowed(source ?? "", `command.${name}`),
      )
      .map(({ name, options }) => ({
        name: `/${name}`,
        help: options.help ?? "",
        params: options.suggestions ?? [],
      }));
  }

  #registerSuggestionsForPlayer(commandsWithSuggestions: RegisteredCommandModel[], source?: string): void {
    const suggestions = this.#getSuggestionsForPlayer(commandsWithSuggestions, source);

    if (this.#isCitizenFXServer) {
      emitNet("chat:addSuggestions", source, suggestions);
      this.#logger.debug(`Registered ${suggestions.length} command suggestions for player ${source}`);
    } else {
      emit("chat:addSuggestions", suggestions);
      this.#logger.debug(`Registered ${suggestions.length} command suggestions for player`);
    }
  }

  ensureCronTickExists() {
    if (this.#cronTickId !== undefined) {
      return;
    }

    if (this.cronJobsRegistry.getAllCronJobs().length === 0) {
      return;
    }

    this.#cronTickId = setTick(async () => {
      await Promise.allSettled(
        this.cronJobsRegistry
          .getAllCronJobs()
          .filter((cronJob) => cronJob.isDue())
          .map(async (cronJob) => {
            try {
              await cronJob.handle();
            } catch (err) {
              this.#logger.error(
                `Error while handling @Cron on method ${cronJob.methodName} in provider ${cronJob.provider.name}:`,
                err,
              );
            } finally {
              cronJob.advanceNextRun();
            }
          }),
      );

      await sleep(60000 - (Date.now() % 60000));
    });
  }

  setupCommandSuggestions(): void {
    const commandsWithSuggestions = this.commandsRegistry.getCommandsWithSuggestions();

    if (commandsWithSuggestions.length === 0) {
      return;
    }

    if (this.#isCitizenFXServer) {
      onNet("chat:init", () => {
        const source = stringifySource(global.source);

        if (!(Number(source) > 0)) {
          return;
        }

        this.#registerSuggestionsForPlayer(commandsWithSuggestions, source);
      });

      for (const player of getPlayers()) {
        this.#registerSuggestionsForPlayer(commandsWithSuggestions, player);
      }
    } else {
      this.#registerSuggestionsForPlayer(commandsWithSuggestions);
    }
  }
}
