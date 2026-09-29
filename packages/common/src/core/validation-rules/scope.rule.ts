import { ValidationRuleInterface } from "@core/interfaces/validation-rule.interface";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { ContextualProviderInjectionException } from "@core/exceptions/contextual-provider-injection.exception";
import { DependencyOutOfScopeException } from "@core/exceptions/dependency-out-of-scope.exception";
import { DependencyUndefinedException } from "@core/exceptions/dependency-undefined.exception";
import { ExportedDependencyNotProvidedException } from "@core/exceptions/exported-dependency-not-provided.exception";
import { WrongDependencyTypeException } from "@core/exceptions/wrong-dependency-type.exception";
import { ScopeMapsInterface } from "@core/interfaces/scope-maps.interface";
import { getTokenName } from "@core/utils/token-name.utils";
import { isTokenVisible } from "@core/utils/scope-lookup.utils";
import { ConstructorType } from "@shared";

export class ScopeValidationRule implements ValidationRuleInterface {
  constructor(private readonly graph: DependencyGraph) {}

  getName(): string {
    return "ScopeValidation";
  }

  validate(nodes: GraphNodeModel[], maps: ScopeMapsInterface): void {
    this.#validateModuleImports(nodes, maps);
    this.#validateDependencyAccess(nodes, maps);
    this.#validateExportsAccess(nodes, maps);
  }

  #validateModuleImports(nodes: GraphNodeModel[], maps: ScopeMapsInterface): void {
    for (const node of nodes) {
      if (node.type !== BytiumDependencyTypeEnum.MODULE) continue;

      const imports = node.getEdgeTargets(GraphEdgeTypeEnum.IMPORTS);

      if (imports.length === 0) continue;

      const moduleName = getTokenName(node.token);
      const ownerResource = maps.moduleOwnerResource.get(node.token);

      for (const importedToken of imports) {
        this.#validateExternalModuleImport(importedToken, moduleName, ownerResource, maps);
      }
    }
  }

  #validateExternalModuleImport(
    importedToken: ConstructorType | string | symbol,
    moduleName: string,
    ownerResource: ConstructorType | string | symbol | undefined,
    maps: ScopeMapsInterface,
  ): void {
    if (typeof importedToken !== "string" || !importedToken.includes(":")) return;

    const parts = importedToken.split(":");

    if (parts.length !== 2) return;

    const [externalResourceName] = parts;

    if (!ownerResource) {
      throw new DependencyOutOfScopeException(
        `Module "${moduleName}" imports external module "${importedToken}" but has no owner resource.`,
      );
    }

    const resourceExternalImports = maps.resourceExternalImports.get(ownerResource);

    if (!resourceExternalImports?.has(externalResourceName)) {
      throw new DependencyOutOfScopeException(
        `Module "${moduleName}" imports external module "${importedToken}", ` +
          `but resource "${getTokenName(
            ownerResource,
          )}" does not import external resource "${externalResourceName}". ` +
          `Add "${externalResourceName}" to resource imports.`,
      );
    }
  }

  #validateDependencyAccess(nodes: GraphNodeModel[], maps: ScopeMapsInterface): void {
    for (const node of nodes) {
      /**
       * Contextual providers are instantiated per context by their driver, which supplies some
       * dependencies not registered in the graph - so their wiring is checked at resolution time,
       * not boot. Mirrors lazy modules.
       */
      if (node.scope === BytiumProviderScopeEnum.CONTEXTUAL) continue;

      for (const dependency of node.getEdgeTargets(GraphEdgeTypeEnum.DEPENDENCY)) {
        const dependencyNode = this.graph.getNode(dependency);

        if (dependencyNode?.type === BytiumDependencyTypeEnum.CUSTOM_PROVIDER) continue;

        if (dependencyNode?.scope === BytiumProviderScopeEnum.CONTEXTUAL) {
          throw new ContextualProviderInjectionException(
            `Provider "${getTokenName(dependency)}" is contextual-scoped and cannot be injected into an eager ` +
              `(singleton) provider - it is instantiated per context by its driver (e.g. one instance per HTTP request).`,
          );
        }

        this.#validateDependentAccess(dependency, node.token, maps);
      }
    }
  }

  #validateExportsAccess(nodes: GraphNodeModel[], maps: ScopeMapsInterface): void {
    for (const node of nodes) {
      if (node.type !== BytiumDependencyTypeEnum.MODULE) continue;

      const exports = node.getEdgeTargets(GraphEdgeTypeEnum.EXPORTS);

      if (exports.length === 0) continue;

      const nodeName = getTokenName(node.token);

      for (const exportedToken of exports) {
        if (!this.#canExport(node.token, exportedToken, maps)) {
          throw new ExportedDependencyNotProvidedException(
            `Module "${nodeName}" exports "${getTokenName(exportedToken)}" but does not provide it. ` +
              `Make sure to include it in the providers array or import a module that provides it.`,
          );
        }
      }
    }
  }

  #validateDependentAccess(
    dependency: ConstructorType | string | symbol,
    dependent: ConstructorType | string | symbol,
    maps: ScopeMapsInterface,
  ): void {
    const dependentNode = this.graph.getNode(dependent);
    const dependencyNode = this.graph.getNode(dependency);
    const dependencyName = getTokenName(dependency);
    const dependentName = getTokenName(dependent);

    if (!dependentNode) {
      throw new DependencyOutOfScopeException(
        `Dependency "${dependencyName}" is not accessible from "${dependentName}". Dependent node not found in graph.`,
      );
    }

    if (!dependencyNode) {
      throw new DependencyUndefinedException(
        `Dependency "${dependencyName}" required by "${dependentName}" is not a registered provider.`,
      );
    }

    if (dependencyNode.type === BytiumDependencyTypeEnum.CONTROLLER) {
      throw new WrongDependencyTypeException(
        `Controller "${dependencyName}" cannot be injected into "${dependentName}". ` +
          `Controllers are entrypoints, not providers - move the shared logic into a provider and inject that instead.`,
      );
    }

    if (dependencyNode.type === BytiumDependencyTypeEnum.EXTERNAL_PROVIDER) {
      if (!this.#canAccessExternalProvider(dependency as string, dependent, maps)) {
        throw new DependencyOutOfScopeException(
          `Dependency "${dependencyName}" is not accessible from "${dependentName}". ` +
            `Make sure the module imports the external module.`,
        );
      }

      return;
    }

    if (maps.globalProviders.has(dependency)) {
      return;
    }

    if (dependentNode.type === BytiumDependencyTypeEnum.MODULE) {
      if (!isTokenVisible(dependency, dependent, maps)) {
        throw new DependencyOutOfScopeException(
          `Dependency "${dependencyName}" is not accessible from module "${dependentName}". ` +
            `Make sure "${dependentName}" provides it or imports a module that exports it.`,
        );
      }

      return;
    }

    if (
      dependentNode.type === BytiumDependencyTypeEnum.PROVIDER ||
      dependentNode.type === BytiumDependencyTypeEnum.CONTROLLER ||
      dependentNode.type === BytiumDependencyTypeEnum.CUSTOM_PROVIDER
    ) {
      if (dependentNode.type === BytiumDependencyTypeEnum.CUSTOM_PROVIDER) {
        const customProvider = dependentNode.metadata.customProvider;

        if (customProvider && "useClass" in customProvider && customProvider.useClass === dependency) {
          return;
        }
      }

      const ownerModules = maps.providerOwnerModules.get(dependent);

      if (!ownerModules || ownerModules.size === 0) {
        throw new DependencyOutOfScopeException(
          `Dependency "${dependencyName}" is not accessible from provider "${dependentName}". Provider has no owner module.`,
        );
      }

      for (const ownerModule of ownerModules) {
        if (!isTokenVisible(dependency, ownerModule, maps)) {
          const moduleName = getTokenName(ownerModule);
          const constructorParams = dependentNode.metadata.constructorParams ?? [];
          const dependencyIndex = constructorParams.indexOf(dependency);
          const indexStr = dependencyIndex >= 0 ? dependencyIndex.toString() : "?";

          throw new DependencyOutOfScopeException(
            `Cannot resolve dependencies of ${dependentName}. ` +
              `Please make sure that the argument ${dependencyName} at index [${indexStr}] is available in the ${moduleName} context.`,
          );
        }
      }

      return;
    }

    throw new DependencyOutOfScopeException(
      `Dependency "${dependencyName}" is not accessible from "${dependentName}". Unknown dependent type.`,
    );
  }

  #canAccessExternalProvider(
    dependency: string,
    dependent: ConstructorType | string | symbol,
    maps: ScopeMapsInterface,
  ): boolean {
    const parts = dependency.split(":");

    if (parts.length !== 3) return false;

    const [externalResourceName, externalModuleName] = parts;
    const externalModuleToken = `${externalResourceName}:${externalModuleName}`;
    const dependentNode = this.graph.getNode(dependent);

    if (!dependentNode) return false;

    if (dependentNode.type === BytiumDependencyTypeEnum.MODULE) {
      const moduleImports = maps.moduleImports.get(dependent) ?? [];

      return moduleImports.includes(externalModuleToken);
    }

    if (
      dependentNode.type === BytiumDependencyTypeEnum.PROVIDER ||
      dependentNode.type === BytiumDependencyTypeEnum.CONTROLLER
    ) {
      const owners = maps.providerOwnerModules.get(dependent);

      if (!owners || owners.size === 0) return false;

      for (const owner of owners) {
        const moduleImports = maps.moduleImports.get(owner) ?? [];

        if (moduleImports.includes(externalModuleToken)) {
          return true;
        }
      }

      return false;
    }

    return false;
  }

  #canExport(
    moduleToken: ConstructorType | string | symbol,
    exportedToken: ConstructorType | string | symbol,
    maps: ScopeMapsInterface,
  ): boolean {
    if (maps.moduleProviders.get(moduleToken)?.has(exportedToken)) {
      return true;
    }

    const imports = maps.moduleImports.get(moduleToken) ?? [];

    if (imports.includes(exportedToken)) {
      return true;
    }

    for (const importedModule of imports) {
      if (maps.moduleExports.get(importedModule)?.has(exportedToken)) {
        return true;
      }
    }

    return false;
  }
}
