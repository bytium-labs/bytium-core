import { DependencyGraph } from "@core/graphs/dependency.graph";
import { DependencyResolver } from "@core/resolvers/dependency.resolver";
import { ModuleRef } from "@core/services/module-ref.service";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { ScopeMapsInterface } from "@core/interfaces/scope-maps.interface";
import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { DependencyUndefinedException } from "@core/exceptions/dependency-undefined.exception";
import { WrongDependencyTypeException } from "@core/exceptions/wrong-dependency-type.exception";
import { getTokenName } from "@core/utils/token-name.utils";
import { ConstructorType } from "@shared";

/**
 * Loads service modules on demand instead of at bootstrap.
 */
export class LazyModuleLoader {
  readonly #loaded = new Map<ConstructorType, ModuleRef>();

  constructor(
    private readonly graph: DependencyGraph,
    private readonly engine: DependencyResolver,
    private readonly scanModule: (module: ConstructorType) => void,
    private readonly rebuildScopeMaps: () => ScopeMapsInterface,
  ) {}

  async load(module: ConstructorType): Promise<ModuleRef> {
    const cached = this.#loaded.get(module);

    if (cached) return cached;

    this.scanModule(module);

    const node = this.graph.getNode(module);

    if (!node || node.type !== BytiumDependencyTypeEnum.MODULE) {
      throw new DependencyUndefinedException(`Cannot lazy-load "${module.name}" - it is not a @BytiumResourceModule.`);
    }

    this.#assertNoControllers(node, module);

    const scopeMaps = this.rebuildScopeMaps();

    await this.engine.resolveLazyModule(module);

    const moduleRef = new ModuleRef(this.graph, this.engine, node, scopeMaps);

    this.#loaded.set(module, moduleRef);

    return moduleRef;
  }

  #assertNoControllers(node: GraphNodeModel, module: ConstructorType): void {
    for (const contained of node.getEdgeTargets(GraphEdgeTypeEnum.CONTAINS)) {
      if (this.graph.getNode(contained)?.type !== BytiumDependencyTypeEnum.CONTROLLER) continue;

      throw new WrongDependencyTypeException(
        `Lazy module "${module.name}" cannot contain controllers - controllers are entrypoints and must be ` +
          `registered eagerly. Move "${getTokenName(contained)}" into an eagerly-imported module.`,
      );
    }
  }
}
