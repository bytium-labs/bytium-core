import { CommandParamSuggestionInterface } from "@citizenfx/interfaces/command-param-suggestion.interface";

/**
 * A command shown in the chat suggestion list.
 */
export interface CommandSuggestionInterface {
  /** Command name with /. */
  name: string;

  /** Command description. */
  help: string;

  /** Command argument suggestions. */
  params: CommandParamSuggestionInterface[];
}
