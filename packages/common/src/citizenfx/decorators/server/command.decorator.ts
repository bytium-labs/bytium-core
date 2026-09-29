import { CommandParamSuggestionInterface } from "@citizenfx/interfaces/command-param-suggestion.interface";
import { BytiumMetadataEnum, BytiumMethodTypeEnum } from "@shared";

/**
 * Options for `@Command()`.
 */
export class CommandOptions {
  /** Command name. */
  name: string;

  /** Command aliases. */
  aliases?: string[];

  /**
   * Whether the command is restricted to principals holding `command.name`.
   *
   * @default false
   */
  isRestricted?: boolean;

  /**
   * Whether the command can be executed by server (console or resource).
   *
   * @default true
   */
  canBeUsedByServer?: boolean = true;

  /**
   * Whether the command can be executed by players.
   *
   * @default true
   */
  canBeUsedByPlayers?: boolean = true;

  /** Command description shown in chat suggestions. */
  help?: string;

  /** Command param suggestions shown in chat. */
  suggestions?: CommandParamSuggestionInterface[];
}

/**
 * Registers a command handler.
 *
 * @param name Command name.
 * @param aliases Command aliases.
 *
 * @remarks Server-side only.
 */
export function Command(name: string, aliases?: string[]): MethodDecorator;
/**
 * Registers a command handler.
 *
 * @param name Command name.
 * @param options \@Command() decorator options.
 *
 * @remarks Server-side only.
 */
export function Command(name: string, options?: Omit<CommandOptions, "name">): MethodDecorator;
/**
 * Registers a command handler.
 *
 * @param options \@Command() decorator options.
 *
 * @remarks Server-side only.
 */
export function Command(options: CommandOptions): MethodDecorator;
export function Command(a: string | CommandOptions, b?: string[] | Omit<CommandOptions, "name">): MethodDecorator {
  const commandOptions = new CommandOptions();

  if (typeof a === "string") {
    commandOptions.name = a;

    if (Array.isArray(b)) {
      commandOptions.aliases = b;
    } else if (b) {
      Object.assign(commandOptions, b);
    }
  } else {
    Object.assign(commandOptions, a);
  }

  return function (target, propertyKey) {
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_TYPE, BytiumMethodTypeEnum.COMMAND, target, propertyKey);
    Reflect.defineMetadata(BytiumMetadataEnum.METHOD_OPTIONS, commandOptions, target, propertyKey);
  };
}
