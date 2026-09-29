import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumExportNameEnum } from "@core/enums/bytium-export-name.enum";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { BytiumResourceStateEnum } from "@core/enums/bytium-resource-state.enum";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { resolveVisibleInstance } from "@core/utils/scope-lookup.utils";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { InstanceEntryModel } from "@core/models/instance-entry.model";
import { BytiumResourceModuleOptions } from "@core/decorators/bytium-resource-module.decorator";
import { ExternalDependencyUnavailableException } from "@core/exceptions/external-dependency-unavailable.exception";
import { instanceOfForwardRefDependency } from "@core/interfaces/forward-ref-dependency.interface";
import { parseExternalDependencyName } from "@core/utils/external-token.utils";
import { getResourceExport } from "@core/utils/resource-export.utils";
import { ResourceStateEnum } from "@citizenfx/enums/resource-state.enum";
import { ConstructorType, sleep } from "@shared";
import { Logger } from "@logger";

export class ExternalResourceResolver {
  readonly #logger = new Logger("bytium");

  constructor(
    private readonly graph: DependencyGraph,
    private readonly addInstance: (node: GraphNodeModel, entry: InstanceEntryModel) => void,
  ) {}

  async resolveExternalResource(node: GraphNodeModel, timeoutMs = 30000): Promise<unknown> {
    if (node.instances.length > 0) return node.instances[0].instance;

    const token = node.token as string;
    const { resourceName } = parseExternalDependencyName(token);

    if (!resourceName) {
      throw new ExternalDependencyUnavailableException(`Resource name in ${token} is not specified.`);
    }

    const state = GetResourceState(resourceName) as ResourceStateEnum;

    if (state !== ResourceStateEnum.STARTED && state !== ResourceStateEnum.STARTING) {
      throw new ExternalDependencyUnavailableException(
        `Resource ${resourceName} is not started/starting. Current state: ${state}.`,
      );
    }

    const getBytiumState = getResourceExport(resourceName, BytiumExportNameEnum.BYTIUM_RESOURCE_STATE);

    if (!getBytiumState) {
      throw new ExternalDependencyUnavailableException(
        `Resource ${resourceName} doesn't expose Bytium resource state.`,
      );
    }

    let bytiumState: BytiumResourceStateEnum = getBytiumState();
    const startTime = Date.now();

    while (bytiumState === BytiumResourceStateEnum.STARTING) {
      if (Date.now() - startTime > timeoutMs) {
        throw new ExternalDependencyUnavailableException(
          `Timeout waiting for bytium resource ${resourceName} to start.`,
        );
      }

      await sleep(1000);

      bytiumState = getBytiumState();
    }

    if (bytiumState !== BytiumResourceStateEnum.STARTED) {
      throw new ExternalDependencyUnavailableException(
        `Bytium resource ${resourceName} failed to start. Current state: ${bytiumState}.`,
      );
    }

    const instance = {};
    const entry = new InstanceEntryModel(instance, BytiumProviderScopeEnum.SINGLETON);

    this.addInstance(node, entry);
    this.graph.markResolved(entry);

    return instance;
  }

  async resolveExternalModule(node: GraphNodeModel): Promise<string[]> {
    if (node.instances.length > 0) return node.instances[0].instance as string[];

    const token = node.token as string;
    const { resourceName, moduleName } = parseExternalDependencyName(token);

    if (!resourceName || !moduleName) {
      throw new ExternalDependencyUnavailableException(`Invalid external module token ${token}.`);
    }

    if ((GetResourceState(resourceName) as ResourceStateEnum) !== ResourceStateEnum.STARTED) {
      throw new ExternalDependencyUnavailableException(`Resource ${resourceName} is not started.`);
    }

    const getProviderNames = getResourceExport(resourceName, moduleName);

    if (!getProviderNames) {
      throw new ExternalDependencyUnavailableException(`Resource ${resourceName} doesn't export module ${moduleName}.`);
    }

    const providerNames: string[] = ((getProviderNames() as (string | null | undefined)[]) ?? []).filter(
      (name): name is string => typeof name === "string" && name.length > 0,
    );
    const entry = new InstanceEntryModel(providerNames, BytiumProviderScopeEnum.SINGLETON);

    this.addInstance(node, entry);
    this.graph.markResolved(entry);

    for (const providerName of providerNames) {
      const providerToken = `${resourceName}:${moduleName}:${providerName}`;
      const providerNode = this.graph.getNode(providerToken);

      if (providerNode?.type === BytiumDependencyTypeEnum.EXTERNAL_PROVIDER) {
        await this.resolveExternalProvider(providerNode);
      }
    }

    return providerNames;
  }

  async resolveExternalProvider(node: GraphNodeModel): Promise<unknown> {
    if (node.instances.length > 0) return node.instances[0].instance;

    const token = node.token as string;
    const { resourceName, moduleName, providerName } = parseExternalDependencyName(token);

    if (!resourceName || !moduleName || !providerName) {
      throw new ExternalDependencyUnavailableException(`Invalid external provider token ${token}.`);
    }

    if ((GetResourceState(resourceName) as ResourceStateEnum) !== ResourceStateEnum.STARTED) {
      throw new ExternalDependencyUnavailableException(`Resource ${resourceName} is not started.`);
    }

    const getExternalProvider = getResourceExport(resourceName, `${moduleName}:${providerName}`);

    if (!getExternalProvider) {
      throw new ExternalDependencyUnavailableException(
        `Resource ${resourceName} module ${moduleName} doesn't export provider ${providerName}.`,
      );
    }

    const instance = getExternalProvider();
    const entry = new InstanceEntryModel(instance, BytiumProviderScopeEnum.SINGLETON);

    this.addInstance(node, entry);
    this.graph.markResolved(entry);

    return instance;
  }

  registerCrossResourceExports(node: GraphNodeModel): void {
    const options = node.metadata.options as BytiumResourceModuleOptions | undefined;

    if (!options?.crossResourceExports || options.crossResourceExports.length === 0) return;

    const exportedNames: string[] = [];

    for (const exported of options.crossResourceExports) {
      if (typeof exported === "string") {
        exportedNames.push(exported);
        global.exports(
          `${options.name}:${exported}`,
          () => resolveVisibleInstance(this.graph, exported, node)?.instance ?? null,
        );

        continue;
      }

      const exportToken = instanceOfForwardRefDependency(exported) ? exported.forwardRef() : exported;
      const exportNode = this.graph.getNode(exportToken);
      const exportName = exportNode?.metadata.transferableName ?? (exportToken as ConstructorType).name;

      exportedNames.push(exportName);
      global.exports(
        `${options.name}:${exportName}`,
        () => resolveVisibleInstance(this.graph, exportToken, node)?.instance ?? null,
      );
    }

    global.exports(options.name, () => exportedNames);
    this.#logger.log(`^2Module ${(node.token as ConstructorType).name} exposed for external resources.`);
  }
}
