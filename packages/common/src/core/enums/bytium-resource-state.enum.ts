/**
 * Lifecycle state of a Bytium resource.
 */
export enum BytiumResourceStateEnum {
  /** The resource is starting up. */
  STARTING = "STARTING",

  /** The resource has finished starting. */
  STARTED = "STARTED",

  /** The resource is shutting down. */
  STOPPING = "STOPPING",

  /** The resource has stopped. */
  STOPPED = "STOPPED",

  /** The resource failed while starting or stopping. */
  FAILED = "FAILED",
}
