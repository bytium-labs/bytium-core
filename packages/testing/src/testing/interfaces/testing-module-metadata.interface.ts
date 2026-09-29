import { TestingImport } from "@testing/types/testing-import.type";
import { TestingProvider } from "@testing/types/testing-provider.type";
import { TestingController } from "@testing/types/testing-controller.type";

/**
 * Metadata for a testing module.
 */
export interface TestingModuleMetadata {
  /** Modules to import. */
  imports?: TestingImport[];

  /** Providers to register. */
  providers?: TestingProvider[];

  /** Controllers to register. */
  controllers?: TestingController[];
}
