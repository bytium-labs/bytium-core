import { CallbacksRegistry } from "@citizenfx/registries/callbacks.registry";
import { CommandsRegistry } from "@citizenfx/registries/commands.registry";
import { CronJobsRegistry } from "@citizenfx/registries/cron-jobs.registry";
import { EventsRegistry } from "@citizenfx/registries/events.registry";
import { KeyBindsRegistry } from "@citizenfx/registries/key-binds.registry";
import { NUICallbacksRegistry } from "@citizenfx/registries/nui-callbacks.registry";
import { TicksRegistry } from "@citizenfx/registries/ticks.registry";

export interface CitizenFXRegistriesInterface {
  callbacksRegistry: CallbacksRegistry;
  commandsRegistry: CommandsRegistry;
  cronJobsRegistry: CronJobsRegistry;
  eventsRegistry: EventsRegistry;
  keyBindsRegistry: KeyBindsRegistry;
  nuiCallbacksRegistry: NUICallbacksRegistry;
  ticksRegistry: TicksRegistry;
}
