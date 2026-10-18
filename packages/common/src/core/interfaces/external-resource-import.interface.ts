/**
 * An external resource import that pins the versions it works with.
 */
export interface ExternalResourceImportInterface {
  /** Name of the external resource. */
  name: string;

  /** Semver range the resource's fxmanifest `version` must satisfy, e.g. `"^1.3.0"`. */
  version: string;
}
