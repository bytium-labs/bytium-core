import * as path from "path";
import type { Configuration } from "webpack";
import { bytiumMinimizer } from "../minimizers/terser.minimizer";
import { BytiumBuildOptions } from "../interfaces/bytium-build-options.interface";

/**
 * Builds a webpack 5 configuration for a Bytium resource bundle.
 *
 * Transpiles with ts-loader (emitting decorator metadata for DI), keeps native `#private`
 * fields, and targets ES2024 for scripting bundles (FiveM Enhanced's Node/V8) - the `ui` target
 * drops to ES2022 for the NUI CEF runtime (Chromium 103). Resources are pre-built with this;
 * the server no longer builds them.
 *
 * The factory only wires the essentials (TS transpile, minify, output, and an HTML page for `ui`).
 * Anything else - CSS/PostCSS/Sass, asset loaders, extra plugins - is brought by the resource
 * through `rules` and `plugins`, resolved from its own dependencies.
 *
 * @param options See {@link BytiumBuildOptions}.
 */
export function createBytiumBuild(options: BytiumBuildOptions): Configuration {
  const { target, entry, outDir, alias = {}, externals = {}, htmlTemplate, rules = [], plugins = [] } = options;
  const isUi = target === "ui";
  const isServer = target === "server";
  const moduleRules: NonNullable<Configuration["module"]>["rules"] = [
    {
      test: /\.tsx?$/,
      exclude: /node_modules/,
      use: {
        loader: require.resolve("ts-loader"),
        options: {
          transpileOnly: true,
          configFile: path.join(path.dirname(entry), "tsconfig.json"),
          compilerOptions: {
            target: isUi ? "es2022" : "es2024",
            module: isUi ? "ES2022" : "CommonJS",
            moduleResolution: isUi ? "Bundler" : "Node",
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            useDefineForClassFields: false,
            ...(isUi ? { jsx: "react-jsx" } : {}),
          },
        },
      },
    },
    ...rules,
  ];
  const webpackPlugins: NonNullable<Configuration["plugins"]> = [];

  if (isUi) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- UI-only dependency, loaded lazily
    const HtmlWebpackPlugin = require("html-webpack-plugin");

    webpackPlugins.push(new HtmlWebpackPlugin(htmlTemplate ? { template: htmlTemplate } : {}));
  }

  webpackPlugins.push(...plugins);

  return {
    mode: "production",
    target: isServer ? "node" : ["web", isUi ? "es2022" : "es2024"],
    entry,
    output: {
      path: outDir,
      filename: isUi ? "[name].js" : "index.js",
      clean: true,
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      symlinks: !isUi,
      alias,
    },
    module: { rules: moduleRules },
    externals,
    plugins: webpackPlugins,
    optimization: {
      minimizer: [bytiumMinimizer()],
    },
    devtool: false,
  };
}
