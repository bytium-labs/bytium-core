import { ValidationRuleInterface } from "@core/interfaces/validation-rule.interface";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumResourceOptions } from "@core/decorators/bytium-resource.decorator";
import { BytiumResourceModuleOptions } from "@core/decorators/bytium-resource-module.decorator";
import { DependencyUndefinedException } from "@core/exceptions/dependency-undefined.exception";
import { PossibleCircularDependencyException } from "@core/exceptions/possible-circular-dependency.exception";
import { instanceOfForwardRefDependency } from "@core/interfaces/forward-ref-dependency.interface";
import { instanceOfBytiumResourceDynamicModule } from "@core/interfaces/bytium-resource-dynamic-module.interface";

export class OptionsArraysValidationRule implements ValidationRuleInterface {
  getName(): string {
    return "OptionsArraysValidation";
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

      if (node.type === BytiumDependencyTypeEnum.MODULE) {
        this.#validateModuleOptions(node, options as BytiumResourceModuleOptions, nodeName);
      } else if (node.type === BytiumDependencyTypeEnum.RESOURCE) {
        this.#validateResourceOptions(options as BytiumResourceOptions, nodeName);
      }
    }
  }

  #validateModuleOptions(node: GraphNodeModel, options: BytiumResourceModuleOptions, nodeName: string): void {
    this.#validateArray(options.imports, "imports", nodeName);
    this.#validateArray(options.providers, "providers", nodeName);
    this.#validateArray(options.exports, "exports", nodeName);
    this.#validateArray(options.controllers, "controllers", nodeName);
    this.#validateArray(options.crossResourceExports, "crossResourceExports", nodeName);

    this.#validateCustomProvidersInArray(options.providers, nodeName);

    this.#validateModuleConstraints(node, options, nodeName);
  }

  #validateResourceOptions(options: BytiumResourceOptions, nodeName: string): void {
    this.#validateArray(options.imports, "imports", nodeName);
    this.#validateArray(options.modules, "modules", nodeName);
  }

  #validateModuleConstraints(node: GraphNodeModel, options: BytiumResourceModuleOptions, nodeName: string): void {
    const isGlobal = node.metadata.isGlobal === true;

    if (isGlobal && (options.crossResourceExports?.length ?? 0) > 0) {
      throw new DependencyUndefinedException(
        `Global module "${nodeName}" cannot have crossResourceExports. ` +
          `Global modules are already accessible everywhere within the resource.`,
      );
    }
  }

  #validateArray(items: unknown[] | undefined, arrayName: string, contextName: string): void {
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item === undefined || item === null) {
        throw new PossibleCircularDependencyException(
          `Detected ${item === null ? "null" : "undefined"} in ${contextName}.${arrayName}[${i}]. ` +
            `This usually indicates a circular import at the module level.\n\n` +
            `Possible causes:\n` +
            `  1. File A imports File B, and File B imports File A (circular import)\n` +
            `  2. Missing export in imported file\n\n` +
            `Solutions:\n` +
            `  1. Use forwardRef(() => YourClass) instead of direct import\n` +
            `  2. Use type-only imports: import type { YourClass } from './your-file'\n` +
            `  3. Restructure your code to avoid circular dependencies`,
        );
      }

      if (instanceOfForwardRefDependency(item)) continue;

      if (instanceOfBytiumResourceDynamicModule(item)) continue;
    }
  }

  #validateCustomProvidersInArray(providers: unknown[] | undefined, contextName: string): void {
    if (!providers) return;

    for (let i = 0; i < providers.length; i++) {
      const item = providers[i];

      if (item === null || item === undefined) continue;

      if (typeof item !== "object") continue;

      if (instanceOfForwardRefDependency(item) || instanceOfBytiumResourceDynamicModule(item)) continue;

      const customProvider = item as Record<string, unknown>;
      const hasValidProvide =
        "provide" in customProvider &&
        (typeof customProvider.provide === "string" ||
          typeof customProvider.provide === "symbol" ||
          typeof customProvider.provide === "function");

      if (!hasValidProvide) {
        throw new DependencyUndefinedException(
          `Custom provider in module "${contextName}" at providers[${i}] is missing a valid "provide" token ` +
            `(must be a string, symbol or class constructor).`,
        );
      }

      if (!(
        "useValue" in customProvider ||
        "useFactory" in customProvider ||
        "useClass" in customProvider ||
        "useExisting" in customProvider
      )) {
        throw new DependencyUndefinedException(
          `Custom provider in module "${contextName}" at providers[${i}] must define one of "useValue", ` +
            `"useFactory", "useClass" or "useExisting".`,
        );
      }

      if ("useFactory" in customProvider && Array.isArray(customProvider.inject)) {
        const provideName =
          typeof customProvider.provide === "string"
            ? customProvider.provide
            : typeof customProvider.provide === "symbol"
              ? customProvider.provide.toString()
              : ((customProvider.provide as { name?: string })?.name ?? "<unknown>");

        for (let j = 0; j < customProvider.inject.length; j++) {
          const dependency = customProvider.inject[j];

          if (dependency === null || dependency === undefined) {
            throw new DependencyUndefinedException(
              `Custom provider "${provideName}" in module "${contextName}" has a null or undefined entry at ` +
                `inject[${j}]. Use "{ token, optional: true }" for an optional dependency.`,
            );
          }
        }
      }
    }
  }
}
