import type { RuleSetRule, WebpackPluginInstance } from "webpack";
import { BytiumBuildTarget } from "../types/bytium-build-target.type";

/** Options for `createBytiumBuild()`. */
export interface BytiumBuildOptions {
  /** Which side of the resource this bundle targets. */
  target: BytiumBuildTarget;

  /** Absolute path to the entry module. */
  entry: string;

  /** Absolute path to the output directory. */
  outDir: string;

  /** Module resolution aliases. */
  alias?: Record<string, string>;

  /** Webpack externals - dependencies left out of the bundle (e.g. server-only native modules). */
  externals?: Record<string, string>;

  /** Absolute path to an HTML template. Used only by the `ui` target. */
  htmlTemplate?: string;

  /**
   * Extra module rules appended after the built-in TS rule - the resource's own processors
   * (CSS/PostCSS/Sass, asset loaders, ...). Resolve their loaders from the resource's dependencies.
   */
  rules?: RuleSetRule[];

  /** Extra webpack plugins appended after the built-in ones. */
  plugins?: WebpackPluginInstance[];
}
