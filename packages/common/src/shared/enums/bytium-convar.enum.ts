/**
 * Framework convar suffixes, read per resource or globally as `<scope>:<suffix>` (resource overrides global).
 */
export enum BytiumConvarEnum {
  LOG_LEVEL = "bytium-core:logLevel",
  DEV_MODE = "bytium-core:devMode",
  LOG_FORMAT = "bytium-core:logFormat",
  LOG_HANDLER_ARGS = "bytium-core:logHandlerArgs",
  LOG_BOUNDARY_EXCLUDE = "bytium-core:logBoundaryExclude",
}
