import TerserPlugin from "terser-webpack-plugin";

export function bytiumMinimizer(config?: any) {
  return new TerserPlugin(
    config ?? {
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: true,
          keep_classnames: true,
          keep_fargs: true,
          keep_fnames: true,
          pure_getters: false,
        },
        format: {
          comments: false,
        },
        mangle: false,
      },
      extractComments: false,
      parallel: true,
    },
  );
}
