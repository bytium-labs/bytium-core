import { ConstructorType, GraphTokenType } from "@bytium-core/common";
import { BytiumDependencyManager } from "@bytium-core/common/internal/managers/bytium-dependency.manager";
import { DependencyGraph } from "@bytium-core/common/internal/graphs/dependency.graph";
import { resolveVisibleInstance } from "@bytium-core/common/internal/utils/scope-lookup.utils";
import { TestingModuleGetOptions } from "@testing/interfaces/testing-module-get-options.interface";

/**
 * A compiled testing module for resolving providers and tearing them down.
 */
export class TestingModule {
  constructor(
    private readonly dependencyManager: BytiumDependencyManager,
    private readonly dependencyGraph: DependencyGraph,
    private readonly rootModuleClass: ConstructorType,
  ) {}

  /** Resolves a provider by token. */
  get<T = unknown>(token: GraphTokenType, options: TestingModuleGetOptions = {}): T {
    const rootModuleNode = this.dependencyGraph.getNode(this.rootModuleClass);

    if (rootModuleNode) {
      const scopedEntry = resolveVisibleInstance(this.dependencyGraph, token, rootModuleNode);

      if (scopedEntry) return scopedEntry.instance as T;
    }

    if (options.strict) {
      throw new Error(`Provider "${this.tokenName(token)}" is not visible from the root module - strict lookup.`);
    }

    const node = this.dependencyGraph.getNode(token);

    if (node && node.instances.length > 0) {
      return node.instances[0].instance as T;
    }

    throw new Error(`Provider "${this.tokenName(token)}" not found in testing module.`);
  }

  /** Destroys every provider in the module. */
  async close(): Promise<void> {
    await this.dependencyManager.destroyAll();
  }

  private tokenName(token: GraphTokenType): string {
    if (typeof token === "string") return token;

    if (typeof token === "symbol") return token.description ?? token.toString();

    return token.name;
  }
}
