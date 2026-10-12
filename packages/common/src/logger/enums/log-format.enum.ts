/**
 * Output format of log lines.
 */
export enum LogFormatEnum {
  /** Human-readable colored console output. */
  PRETTY = "PRETTY",

  /** One JSON object per line, for log collectors. */
  JSON = "JSON",
}
