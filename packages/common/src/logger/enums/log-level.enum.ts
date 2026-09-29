/**
 * Severity of a log message.
 */
export enum LogLevelEnum {
  /** Most detailed diagnostic output. */
  VERBOSE = "VERBOSE",

  /** Debugging detail. */
  DEBUG = "DEBUG",

  /** General informational message. */
  INFO = "INFO",

  /** Something unexpected that is not an error. */
  WARN = "WARN",

  /** A recoverable error. */
  ERROR = "ERROR",

  /** An unrecoverable error. */
  FATAL = "FATAL",
}
