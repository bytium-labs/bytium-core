import { BytiumResourceStateEnum } from "@core/enums/bytium-resource-state.enum";
import { BytiumExportNameEnum } from "@core/enums/bytium-export-name.enum";
import { BytiumDependencyManager } from "@core/managers/bytium-dependency.manager";
import { ConstructorType } from "@shared";
import { Logger } from "@logger";

export class BytiumRuntimeManager {
  readonly #logger = new Logger("bytium");
  readonly #isCitizenFXServer: boolean = IsDuplicityVersion();
  readonly #resourceName: string = GetCurrentResourceName();
  #resourceState: BytiumResourceStateEnum = BytiumResourceStateEnum.STARTING;
  #bootstrapPromise?: Promise<void>;

  constructor(private readonly bytiumDependencyManager: BytiumDependencyManager = new BytiumDependencyManager()) {
    global.exports(BytiumExportNameEnum.BYTIUM_RESOURCE_STATE, () => this.#resourceState);
    this.#setupStopHandler();
    this.#setupStartHandler();
  }

  async registerResource<T extends ConstructorType>(target: T): Promise<void> {
    this.#bootstrapPromise = this.#bootstrap(target);
    await this.#bootstrapPromise;
  }

  async #bootstrap<T extends ConstructorType>(target: T): Promise<void> {
    try {
      this.#logger.log(`Starting resource ${target.name}...`);

      await this.bytiumDependencyManager.resolve(target);
      await this.bytiumDependencyManager.bootstrapAll();

      this.#resourceState = BytiumResourceStateEnum.STARTED;
      this.#logger.log(`Resource ${target.name} started.`);
    } catch (error) {
      this.#logger.error(`Failed to start resource ${target.name}.`, error);
      this.#resourceState = BytiumResourceStateEnum.FAILED;
    }
  }

  #setupStopHandler(): void {
    on("onResourceStop", async (resourceName: string) => {
      if (resourceName !== this.#resourceName) return;

      if (this.#resourceState !== BytiumResourceStateEnum.STARTED) return;

      try {
        this.#resourceState = BytiumResourceStateEnum.STOPPING;
        await this.bytiumDependencyManager.destroyAll();
      } catch (error) {
        this.#logger.error("Failed to stop resource cleanly.", error);
      } finally {
        this.#resourceState = BytiumResourceStateEnum.STOPPED;
      }
    });
  }

  #setupStartHandler(): void {
    on(this.#isCitizenFXServer ? "onServerResourceStart" : "onClientResourceStart", async (resourceName: string) => {
      if (resourceName !== this.#resourceName) return;

      try {
        if (this.#bootstrapPromise) await this.#bootstrapPromise;

        if (this.#resourceState !== BytiumResourceStateEnum.STARTED) return;

        await this.bytiumDependencyManager.startAll();
      } catch (error) {
        this.#logger.error("Failed to invoke onResourceStarted handlers.", error);
      }
    });
  }
}

export const bytiumRuntimeManagerInstance = new BytiumRuntimeManager();
