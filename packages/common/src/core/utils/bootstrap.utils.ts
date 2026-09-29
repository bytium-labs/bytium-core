import { bytiumRuntimeManagerInstance } from "@core/managers/bytium-runtime.manager";
import { BYTIUM_VERSION } from "@core/version";
import { Logger } from "@logger";
import { ConstructorType } from "@shared";

/**
 * Bootstraps a Bytium resource and starts the dependency injection container.
 *
 * @param resource The class decorated with `@BytiumResource`.
 */
export async function bootstrap<T extends ConstructorType>(resource: T): Promise<void> {
  new Logger("bytium").debug(`bytium-core v${BYTIUM_VERSION} — bytium.dev`);

  await bytiumRuntimeManagerInstance.registerResource(resource);
}
