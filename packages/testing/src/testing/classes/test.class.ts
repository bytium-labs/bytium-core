import { TestingModuleBuilder } from "@testing/builders/testing-module.builder";
import { TestingModuleMetadata } from "@testing/interfaces/testing-module-metadata.interface";

/**
 * Entry point for building a testing module.
 */
export class Test {
  /** Starts building a testing module from the given metadata. */
  static createTestingModule(metadata: TestingModuleMetadata): TestingModuleBuilder {
    return new TestingModuleBuilder(metadata);
  }
}
