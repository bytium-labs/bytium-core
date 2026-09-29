import { ValidationRuleInterface } from "@core/interfaces/validation-rule.interface";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { ConstructorType } from "@shared";
import { WrongDependencyTypeException } from "@core/exceptions/wrong-dependency-type.exception";
import { instanceOfBytiumResourceDynamicModule } from "@core/interfaces/bytium-resource-dynamic-module.interface";
import { instanceOfForwardRefDependency } from "@core/interfaces/forward-ref-dependency.interface";
import { BytiumResourceModuleOptions } from "@core/decorators/bytium-resource-module.decorator";
import { BytiumResourceOptions } from "@core/decorators/bytium-resource.decorator";
import { isCustomProvider } from "@core/utils/is-custom-provider.utils";

export class DependencyTypesValidationRule implements ValidationRuleInterface {
  readonly #MODULE = BytiumDependencyTypeEnum.MODULE;
  readonly #EXTERNAL_MODULE = BytiumDependencyTypeEnum.EXTERNAL_MODULE;
  readonly #PROVIDER = BytiumDependencyTypeEnum.PROVIDER;
  readonly #CONTROLLER = BytiumDependencyTypeEnum.CONTROLLER;
  readonly #EXTERNAL_PROVIDER = BytiumDependencyTypeEnum.EXTERNAL_PROVIDER;
  readonly #CUSTOM_PROVIDER = BytiumDependencyTypeEnum.CUSTOM_PROVIDER;
  readonly #RESOURCE = BytiumDependencyTypeEnum.RESOURCE;

  constructor(private readonly graph: DependencyGraph) {}

  getName(): string {
    return "DependencyTypesValidation";
  }

  validate(nodes: GraphNodeModel[]): void {
    for (const node of nodes) {
      const options = node.metadata.options;

      if (!options) continue;

      const nodeName =
        typeof node.token === "function"
          ? node.token.name
          : typeof node.token === "symbol"
            ? node.token.toString()
            : node.token;

      if (node.type === this.#MODULE) {
        this.#validateModuleDependencyTypes(options as BytiumResourceModuleOptions, nodeName);
      }

      if (node.type === this.#RESOURCE) {
        this.#validateResourceDependencyTypes(options as BytiumResourceOptions, nodeName);
      }
    }
  }

  #validateModuleDependencyTypes(options: BytiumResourceModuleOptions, nodeName: string): void {
    if (options.imports) {
      for (const [index, item] of options.imports.entries()) {
        if (item === null || item === undefined) continue;

        if (instanceOfBytiumResourceDynamicModule(item)) continue;

        let token: ConstructorType;

        if (typeof item === "function") {
          token = item;
        } else if (instanceOfForwardRefDependency(item)) {
          token = item.forwardRef();
        } else {
          continue;
        }

        const tokenName = typeof token === "function" ? token.name : token;
        const tokenNode = this.graph.getNode(token);

        if (!tokenNode) {
          throw new WrongDependencyTypeException(
            `Import "${tokenName}" in module "${nodeName}" at imports[${index}] not found in graph. ` +
              `Make sure it's decorated properly.`,
          );
        }

        if (![this.#MODULE, this.#EXTERNAL_MODULE].includes(tokenNode.type)) {
          throw new WrongDependencyTypeException(
            `Import "${tokenName}" in module "${nodeName}" at imports[${index}] has wrong type "${tokenNode.type}". ` +
              `Expected MODULE or EXTERNAL_MODULE. Did you mean to add it to providers instead?`,
          );
        }
      }
    }

    if (options.providers) {
      for (const [index, item] of options.providers.entries()) {
        if (item === null || item === undefined) continue;

        if (isCustomProvider(item)) {
          if ("useClass" in item && typeof item.useClass !== "function") {
            throw new WrongDependencyTypeException(
              `Custom provider "${String(item.provide)}" in module "${nodeName}" at providers[${index}] ` +
                `has a "useClass" that is not a class constructor.`,
            );
          }

          continue;
        }

        let token: ConstructorType;

        if (typeof item === "function") {
          token = item;
        } else if (instanceOfForwardRefDependency(item)) {
          token = item.forwardRef();
        } else {
          continue;
        }

        const tokenName = typeof token === "function" ? token.name : token;
        const tokenNode = this.graph.getNode(token);

        if (!tokenNode) {
          throw new WrongDependencyTypeException(
            `Provider "${tokenName}" in module "${nodeName}" at providers[${index}] not found in graph. ` +
              `Make sure it's decorated properly.`,
          );
        }

        if (tokenNode.type === this.#CONTROLLER) {
          throw new WrongDependencyTypeException(
            `Controller "${tokenName}" in module "${nodeName}" at providers[${index}] must be registered in the ` +
              `controllers array, not providers.`,
          );
        }

        if (![this.#PROVIDER, this.#EXTERNAL_PROVIDER, this.#CUSTOM_PROVIDER].includes(tokenNode.type)) {
          throw new WrongDependencyTypeException(
            `Provider "${tokenName}" in module "${nodeName}" at providers[${index}] has wrong type "${tokenNode.type}". ` +
              `Expected PROVIDER or EXTERNAL_PROVIDER. Did you forget the @Injectable() decorator?`,
          );
        }
      }
    }

    if (options.exports) {
      for (const [index, item] of options.exports.entries()) {
        if (item === null || item === undefined) continue;

        if (typeof item === "string") continue;

        let token: ConstructorType;

        if (typeof item === "function") {
          token = item;
        } else if (instanceOfForwardRefDependency(item)) {
          token = item.forwardRef();
        } else {
          continue;
        }

        const tokenNode = this.graph.getNode(token);

        if (!tokenNode) continue;

        const tokenName = typeof token === "function" ? token.name : token;

        if (
          tokenNode.type !== this.#PROVIDER &&
          tokenNode.type !== this.#MODULE &&
          tokenNode.type !== this.#CUSTOM_PROVIDER
        ) {
          throw new WrongDependencyTypeException(
            `Export "${tokenName}" in module "${nodeName}" at exports[${index}] has wrong type "${tokenNode.type}". ` +
              `Expected PROVIDER (provider export) or MODULE (whole-module re-export).`,
          );
        }
      }
    }

    if (options.controllers) {
      for (const [index, item] of options.controllers.entries()) {
        if (item === null || item === undefined) continue;

        if (typeof item !== "function") continue;

        const tokenNode = this.graph.getNode(item);

        if (!tokenNode) {
          throw new WrongDependencyTypeException(
            `Controller "${item.name}" in module "${nodeName}" at controllers[${index}] not found in graph. ` +
              `Make sure it's decorated properly.`,
          );
        }

        if (tokenNode.type !== this.#CONTROLLER) {
          throw new WrongDependencyTypeException(
            `Controller "${item.name}" in module "${nodeName}" at controllers[${index}] has wrong type "${tokenNode.type}". ` +
              `Expected CONTROLLER. Did you forget the @Controller() decorator?`,
          );
        }
      }
    }

    this.#validateCrossResourceExports(options, nodeName);
  }

  #validateCrossResourceExports(options: BytiumResourceModuleOptions, nodeName: string): void {
    if (!options.crossResourceExports) return;

    for (const [index, item] of options.crossResourceExports.entries()) {
      if (item === null || item === undefined) continue;

      if (typeof item === "string") continue;

      let token: ConstructorType;

      if (typeof item === "function") {
        token = item;
      } else if (instanceOfForwardRefDependency(item)) {
        token = item.forwardRef();
      } else {
        continue;
      }

      const tokenNode = this.graph.getNode(token);

      if (!tokenNode) {
        throw new WrongDependencyTypeException(
          `crossResourceExports[${index}] "${token.name}" in module "${nodeName}" not found in graph. ` +
            `Make sure it's decorated properly.`,
        );
      }

      if (tokenNode.type !== this.#PROVIDER) {
        throw new WrongDependencyTypeException(
          `crossResourceExports[${index}] "${token.name}" in module "${nodeName}" has wrong type "${tokenNode.type}". ` +
            `Expected PROVIDER. Only providers can be cross-resource exported.`,
        );
      }

      const exportName = tokenNode.metadata.transferableName;

      if (!exportName) {
        throw new WrongDependencyTypeException(
          `crossResourceExports[${index}] "${token.name}" in module "${nodeName}" is missing @Transferable() decorator. ` +
            `All providers in crossResourceExports must be decorated with @Transferable("exportName").`,
        );
      }
    }
  }

  #validateResourceDependencyTypes(options: BytiumResourceOptions, nodeName: string): void {
    if (options.imports) {
      for (const [index, item] of options.imports.entries()) {
        if (item === null || item === undefined) continue;

        if (typeof item !== "string") {
          throw new WrongDependencyTypeException(
            `Import in resource "${nodeName}" at imports[${index}] is not a string. ` +
              `Resource imports must be external resource links (strings like "resource-name:ModuleName").`,
          );
        }
      }
    }

    if (options.modules) {
      for (const [index, item] of options.modules.entries()) {
        if (item === null || item === undefined) continue;

        if (instanceOfBytiumResourceDynamicModule(item)) continue;

        if (typeof item !== "function") continue;

        const tokenNode = this.graph.getNode(item);

        if (!tokenNode) {
          throw new WrongDependencyTypeException(
            `Module "${item.name}" in resource "${nodeName}" at modules[${index}] not found in graph. ` +
              `Make sure it's decorated properly.`,
          );
        }

        if (tokenNode.type !== this.#MODULE) {
          throw new WrongDependencyTypeException(
            `Module "${item.name}" in resource "${nodeName}" at modules[${index}] has wrong type "${tokenNode.type}". ` +
              `Expected MODULE. Did you forget the @BytiumResourceModule() decorator?`,
          );
        }
      }
    }
  }
}
