import { Injectable } from "@core/decorators/injectable.decorator";
import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { DiscoveredControllerInterface } from "@core/interfaces/discovered-controller.interface";
import { DiscoveredModuleInterface } from "@core/interfaces/discovered-module.interface";
import { DiscoveredProviderInterface } from "@core/interfaces/discovered-provider.interface";
import { ConstructorType } from "@shared";

/**
 * Read-only introspection over the live dependency graph.
 */
@Injectable()
export class DiscoveryService {
  constructor(private readonly graph: DependencyGraph) {}

  /** Returns every resolved provider instance (regular and custom providers) with its token and scope; alias entries are skipped. */
  getProviders(): DiscoveredProviderInterface[] {
    const discovered: DiscoveredProviderInterface[] = [];

    for (const node of this.graph.getAllNodes()) {
      if (node.type !== BytiumDependencyTypeEnum.PROVIDER && node.type !== BytiumDependencyTypeEnum.CUSTOM_PROVIDER) {
        continue;
      }

      const entry = node.instances.find((instanceEntry) => !instanceEntry.isAlias);

      if (!entry) continue;

      discovered.push({ instance: entry.instance as object, token: node.token, scope: entry.scope });
    }

    return discovered;
  }

  /** Returns every resolved controller instance with its token and scope; alias entries are skipped. See {@link getControllerClasses} for classes that were never eagerly instantiated. */
  getControllers(): DiscoveredControllerInterface[] {
    const discovered: DiscoveredControllerInterface[] = [];

    for (const node of this.graph.getAllNodes()) {
      if (node.type !== BytiumDependencyTypeEnum.CONTROLLER) continue;

      const entry = node.instances.find((instanceEntry) => !instanceEntry.isAlias);

      if (!entry) continue;

      discovered.push({ instance: entry.instance as object, token: node.token, scope: entry.scope });
    }

    return discovered;
  }

  /**
   * Returns the class token of every registered controller, whether or not it has been instantiated.
   * Unlike {@link getControllers} (which surfaces live instances), this lists controller classes so a
   * driver can read their metadata - e.g. the HTTP package building its routing table from contextual
   * (never eagerly instantiated) controllers.
   */
  getControllerClasses(): ConstructorType[] {
    const classes: ConstructorType[] = [];

    for (const node of this.graph.getAllNodes()) {
      if (node.type !== BytiumDependencyTypeEnum.CONTROLLER) continue;

      if (typeof node.token === "function") classes.push(node.token as ConstructorType);
    }

    return classes;
  }

  /** Returns every registered module with its token and class (dynamic-module tokens resolve their class via metadata). */
  getModules(): DiscoveredModuleInterface[] {
    const discovered: DiscoveredModuleInterface[] = [];

    for (const node of this.graph.getAllNodes()) {
      if (node.type !== BytiumDependencyTypeEnum.MODULE) continue;

      const moduleClass =
        typeof node.token === "function" ? (node.token as ConstructorType) : node.metadata.moduleClass;

      discovered.push({ token: node.token, moduleClass });
    }

    return discovered;
  }
}
