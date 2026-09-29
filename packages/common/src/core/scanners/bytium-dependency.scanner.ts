import { BytiumResourceOptions } from "@core/decorators/bytium-resource.decorator";
import { BytiumResourceModuleOptions } from "@core/decorators/bytium-resource-module.decorator";
import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";
import { GraphEdgeTypeEnum } from "@core/enums/graph-edge-type.enum";
import { GraphNodeOriginEnum } from "@core/enums/graph-node-origin.enum";
import { DuplicateProviderException } from "@core/exceptions/duplicate-provider.exception";
import { MixedMultiProviderException } from "@core/exceptions/mixed-multi-provider.exception";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import {
  BytiumResourceDynamicModuleInterface,
  instanceOfBytiumResourceDynamicModule,
} from "@core/interfaces/bytium-resource-dynamic-module.interface";
import { GraphNodeMetadataInterface } from "@core/interfaces/graph-node-metadata.interface";
import { PropertyInjectionInterface } from "@core/interfaces/property-injection.interface";
import { CustomProviderConfigType } from "@core/types/custom-provider-config.type";
import { instanceOfForwardRefDependency } from "@core/interfaces/forward-ref-dependency.interface";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { GraphTokenType } from "@core/types/graph-token.type";
import { getOrCreateModuleToken } from "@core/utils/dynamic-module-token.utils";
import { getTokenName } from "@core/utils/token-name.utils";
import { isCustomProvider } from "@core/utils/is-custom-provider.utils";
import { unwrapToken } from "@core/utils/unwrap-token.utils";
import { isExternalTokenString } from "@core/utils/external-token.utils";
import { BytiumMetadataEnum, ConstructorType, INQUIRER } from "@shared";
import { MODULE_REF_OWNER } from "@shared/consts/module-ref-owner.const";

export class BytiumDependencyScanner {
  readonly #visited: Set<GraphTokenType> = new Set();

  constructor(private readonly graph: DependencyGraph) {}

  scan(target: ConstructorType): void {
    this.#visited.clear();
    this.#scanResource(target);
  }

  scanCoreModule(target: ConstructorType): void {
    this.#scanModule(target);
  }

  scanModuleClass(target: ConstructorType): void {
    this.#scanModule(target);
  }

  #resolveScope(target: ConstructorType): BytiumProviderScopeEnum {
    const scope = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_SCOPE, target) as
      BytiumProviderScopeEnum | undefined;

    return scope ?? BytiumProviderScopeEnum.SINGLETON;
  }

  #createNode(
    token: ConstructorType | string | symbol,
    type: BytiumDependencyTypeEnum,
    metadata: GraphNodeMetadataInterface = {},
    scope?: BytiumProviderScopeEnum,
  ): void {
    this.graph.addNode(new GraphNodeModel(token, type, GraphNodeOriginEnum.STATIC, metadata, null, scope));
  }

  #scanResource(target: ConstructorType): void {
    if (this.#visited.has(target)) return;

    this.#visited.add(target);

    const options: BytiumResourceOptions = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONS, target);

    if (!options) return;

    this.#createNode(target, BytiumDependencyTypeEnum.RESOURCE, { options });

    for (const resource of options.imports ?? []) {
      if (typeof resource !== "string") continue;

      this.#createNode(resource, BytiumDependencyTypeEnum.EXTERNAL_RESOURCE);
      this.graph.addEdge(target, resource, GraphEdgeTypeEnum.IMPORTS);
    }

    for (const module of options.modules) {
      if (instanceOfBytiumResourceDynamicModule(module)) {
        const dynamicToken = this.#scanDynamicModule(module);

        this.graph.addEdge(target, dynamicToken, GraphEdgeTypeEnum.CONTAINS);

        continue;
      }

      this.#scanModule(module as ConstructorType);
      this.graph.addEdge(target, module as ConstructorType, GraphEdgeTypeEnum.CONTAINS);
    }
  }

  #scanModule(target: ConstructorType): void {
    if (this.#visited.has(target)) return;

    this.#visited.add(target);

    const options: BytiumResourceModuleOptions = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONS, target);

    if (!options) return;

    const isGlobal = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_GLOBAL, target) === true;

    this.#buildModuleNode(target, options, isGlobal, target);
  }

  #scanDynamicModule(dynamicModule: BytiumResourceDynamicModuleInterface): GraphTokenType {
    const moduleToken = getOrCreateModuleToken(dynamicModule);

    if (this.#visited.has(moduleToken)) return moduleToken;

    this.#visited.add(moduleToken);

    const decoratorOptions: BytiumResourceModuleOptions =
      Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONS, dynamicModule.module) || {};
    const syntheticOptions: BytiumResourceModuleOptions = {
      name: dynamicModule.name || decoratorOptions.name,
      imports: dynamicModule.imports ?? decoratorOptions.imports ?? [],
      providers: dynamicModule.providers ?? decoratorOptions.providers ?? [],
      controllers: dynamicModule.controllers ?? decoratorOptions.controllers ?? [],
      exports: dynamicModule.exports ?? decoratorOptions.exports ?? [],
      crossResourceExports: dynamicModule.crossResourceExports ?? decoratorOptions.crossResourceExports ?? [],
    };
    const decoratorGlobal = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_GLOBAL, dynamicModule.module) === true;
    const isGlobal = dynamicModule.global !== undefined ? dynamicModule.global : decoratorGlobal;

    this.#buildModuleNode(moduleToken, syntheticOptions, isGlobal, dynamicModule.module);

    return moduleToken;
  }

  #buildModuleNode(
    token: GraphTokenType,
    options: BytiumResourceModuleOptions,
    isGlobal: boolean,
    moduleClass?: ConstructorType,
  ): void {
    const constructorParams: GraphTokenType[] = moduleClass
      ? (Reflect.getMetadata(BytiumMetadataEnum.DESIGN_PARAMTYPES, moduleClass) ?? [])
      : [];
    const optionalParams: number[] = moduleClass
      ? (Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONAL_PARAMS, moduleClass) ?? [])
      : [];
    const forwardRefParams: number[] = [];

    constructorParams.forEach((param, index) => {
      if (instanceOfForwardRefDependency(param)) {
        forwardRefParams.push(index);
      }
    });

    this.#createNode(token, BytiumDependencyTypeEnum.MODULE, {
      options,
      isGlobal,
      moduleClass,
      constructorParams,
      forwardRefParams,
      optionalParams,
    });

    for (const module of options.imports ?? []) {
      if (instanceOfBytiumResourceDynamicModule(module)) {
        const dynamicToken = this.#scanDynamicModule(module);

        this.graph.addEdge(token, dynamicToken, GraphEdgeTypeEnum.IMPORTS);

        continue;
      }

      if (instanceOfForwardRefDependency(module)) {
        const resolved = module.forwardRef();

        if (typeof resolved === "function") {
          this.#scanModule(resolved);
          this.graph.addEdge(token, resolved, GraphEdgeTypeEnum.IMPORTS);
        }

        continue;
      }

      if (typeof module === "string") {
        this.#createNode(module, BytiumDependencyTypeEnum.EXTERNAL_MODULE);
        this.graph.addEdge(token, module, GraphEdgeTypeEnum.IMPORTS);

        continue;
      }

      this.#scanModule(module as ConstructorType);
      this.graph.addEdge(token, module as ConstructorType, GraphEdgeTypeEnum.IMPORTS);
    }

    for (const provider of options.providers ?? []) {
      if (provider === null || provider === undefined) continue;

      if (isCustomProvider(provider)) {
        const config = provider as CustomProviderConfigType;
        const isMulti = (config as { multi?: boolean }).multi === true;
        const existingNode = this.graph.getNode(provider.provide);

        if (isMulti) {
          if (existingNode && existingNode.type !== BytiumDependencyTypeEnum.MULTI_PROVIDER) {
            throw new MixedMultiProviderException(
              `Provider "${getTokenName(provider.provide)}" in ${getTokenName(token)} mixes a multi: true ` +
                `registration with a non-multi one under the same token. Mark every registration with multi: true.`,
            );
          }

          if (!existingNode) {
            this.#createNode(provider.provide, BytiumDependencyTypeEnum.MULTI_PROVIDER, { multiMembers: [] });
            this.graph.addEdge(token, provider.provide, GraphEdgeTypeEnum.CONTAINS);
          }

          const aggregator = this.graph.getNode(provider.provide) as GraphNodeModel;
          const members = aggregator.metadata.multiMembers ?? [];
          const memberToken = Symbol(`multi:${getTokenName(provider.provide)}:${members.length}`);

          members.push(memberToken);
          aggregator.metadata.multiMembers = members;
          this.graph.addEdge(provider.provide, memberToken, GraphEdgeTypeEnum.MULTI_MEMBER);
          this.#buildCustomProviderNode(config, memberToken, token);

          continue;
        }

        if (existingNode && existingNode.type === BytiumDependencyTypeEnum.MULTI_PROVIDER) {
          throw new MixedMultiProviderException(
            `Provider "${getTokenName(provider.provide)}" in ${getTokenName(token)} mixes a non-multi registration ` +
              `with a multi: true one under the same token. Mark every registration with multi: true.`,
          );
        }

        if (existingNode && existingNode.type === BytiumDependencyTypeEnum.CUSTOM_PROVIDER) {
          throw new DuplicateProviderException(
            `Duplicate provider "${getTokenName(provider.provide)}" in ${getTokenName(token)}`,
          );
        }

        this.#buildCustomProviderNode(config, provider.provide, token);

        continue;
      }

      if (instanceOfForwardRefDependency(provider)) {
        const resolved = provider.forwardRef();

        if (typeof resolved === "function") {
          this.#scanProvider(resolved);
          this.graph.addEdge(token, resolved, GraphEdgeTypeEnum.CONTAINS);
        }

        continue;
      }

      if (typeof provider === "string") {
        if (provider.includes(":")) {
          this.#createNode(provider, BytiumDependencyTypeEnum.EXTERNAL_PROVIDER);
          this.graph.addEdge(token, provider, GraphEdgeTypeEnum.CONTAINS);
        }

        continue;
      }

      this.#scanProvider(provider as ConstructorType);
      this.graph.addEdge(token, provider as ConstructorType, GraphEdgeTypeEnum.CONTAINS);
    }

    for (const controller of options.controllers ?? []) {
      if (controller === null || controller === undefined) continue;

      if (instanceOfForwardRefDependency(controller)) {
        const resolved = controller.forwardRef();

        if (typeof resolved === "function") {
          this.#scanProvider(resolved);
          this.graph.addEdge(token, resolved, GraphEdgeTypeEnum.CONTAINS);
        }

        continue;
      }

      this.#scanProvider(controller as ConstructorType);
      this.graph.addEdge(token, controller as ConstructorType, GraphEdgeTypeEnum.CONTAINS);
    }

    for (const exported of options.exports ?? []) {
      const exportedToken = this.#resolveToken(exported);

      if (exportedToken) {
        this.graph.addEdge(token, exportedToken, GraphEdgeTypeEnum.EXPORTS);
      }
    }

    constructorParams.forEach((param, index) => {
      if (param === INQUIRER) return;

      if (param === MODULE_REF_OWNER) return;

      if (optionalParams.includes(index)) return;

      const paramToken = this.#resolveToken(param);

      if (!paramToken) return;

      if (typeof paramToken === "string" && isExternalTokenString(paramToken)) {
        if (!this.graph.getNode(paramToken)) {
          this.#createNode(paramToken, BytiumDependencyTypeEnum.EXTERNAL_PROVIDER);
        }
      }

      this.graph.addEdge(token, paramToken, GraphEdgeTypeEnum.DEPENDENCY);
    });
  }

  scanProviderMetadataOnly(target: ConstructorType): void {
    if (this.#visited.has(target)) return;

    this.#visited.add(target);

    const params: ConstructorType[] = Reflect.getMetadata(BytiumMetadataEnum.DESIGN_PARAMTYPES, target) ?? [];
    const transferableName = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_PUBLIC_EXPORT_NAME, target);

    this.#createNode(
      target,
      BytiumDependencyTypeEnum.PROVIDER,
      { constructorParams: params, transferableName },
      this.#resolveScope(target),
    );
  }

  #scanProvider(target: ConstructorType): void {
    if (this.#visited.has(target)) return;

    this.#visited.add(target);

    const dependencyType = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_TYPE, target);

    if (
      dependencyType !== BytiumDependencyTypeEnum.PROVIDER &&
      dependencyType !== BytiumDependencyTypeEnum.CONTROLLER
    ) {
      return;
    }

    const params: GraphTokenType[] = Reflect.getMetadata(BytiumMetadataEnum.DESIGN_PARAMTYPES, target) ?? [];
    const transferableName = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_PUBLIC_EXPORT_NAME, target);
    const optionalParams: number[] = Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONAL_PARAMS, target) ?? [];
    const optionalProperties: (string | symbol)[] =
      Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_OPTIONAL_PROPERTIES, target) ?? [];
    const propertyInjections: PropertyInjectionInterface[] = (
      Reflect.getMetadata(BytiumMetadataEnum.PROPERTY_INJECTIONS, target) ?? []
    ).map((injection: PropertyInjectionInterface) => ({
      ...injection,
      optional: optionalProperties.includes(injection.propertyKey),
    }));
    const forwardRefParams: number[] = [];

    params.forEach((param, index) => {
      if (instanceOfForwardRefDependency(param)) {
        forwardRefParams.push(index);
      }
    });

    this.#createNode(
      target,
      dependencyType,
      {
        constructorParams: params,
        transferableName,
        forwardRefParams,
        optionalParams,
        propertyInjections,
      },
      this.#resolveScope(target),
    );

    params.forEach((param, index) => {
      if (param === INQUIRER) return;

      if (param === MODULE_REF_OWNER) return;

      if (optionalParams.includes(index)) return;

      const paramToken = this.#resolveToken(param);

      if (!paramToken) return;

      if (typeof paramToken === "string" && isExternalTokenString(paramToken)) {
        if (!this.graph.getNode(paramToken)) {
          this.#createNode(paramToken, BytiumDependencyTypeEnum.EXTERNAL_PROVIDER);
        }
      }

      this.graph.addEdge(target, paramToken, GraphEdgeTypeEnum.DEPENDENCY);
    });

    propertyInjections.forEach((injection) => {
      if (injection.optional) return;

      const token = this.#resolveToken(injection.token as GraphTokenType);

      if (!token) return;

      this.graph.addEdge(target, token, GraphEdgeTypeEnum.DEPENDENCY);
    });
  }

  #buildCustomProviderNode(
    config: CustomProviderConfigType,
    nodeToken: GraphTokenType,
    moduleToken: GraphTokenType,
  ): void {
    const explicitScope = (config as { scope?: BytiumProviderScopeEnum }).scope;
    const useClassTarget = "useClass" in config && config.useClass ? (config.useClass as ConstructorType) : undefined;
    const useClassIsTransient =
      useClassTarget !== undefined &&
      Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_SCOPE, useClassTarget) === BytiumProviderScopeEnum.TRANSIENT;
    const resolvedScope =
      explicitScope ?? (useClassIsTransient ? BytiumProviderScopeEnum.TRANSIENT : BytiumProviderScopeEnum.SINGLETON);

    this.#createNode(nodeToken, BytiumDependencyTypeEnum.CUSTOM_PROVIDER, { customProvider: config }, resolvedScope);
    this.graph.addEdge(moduleToken, nodeToken, GraphEdgeTypeEnum.CONTAINS);

    if ("useClass" in config && config.useClass) {
      if (!this.graph.getNode(config.useClass)) {
        this.scanProviderMetadataOnly(config.useClass);
      }

      this.graph.addEdge(nodeToken, config.useClass, GraphEdgeTypeEnum.DEPENDENCY);
    }

    if ("useExisting" in config && config.useExisting) {
      const existingToken = unwrapToken(config.useExisting);

      if (existingToken) {
        this.graph.addEdge(nodeToken, existingToken, GraphEdgeTypeEnum.DEPENDENCY);
      }
    }

    if ("inject" in config && config.inject) {
      for (const dependency of config.inject) {
        const isOptionalRef =
          typeof dependency === "object" &&
          dependency !== null &&
          "optional" in dependency &&
          (dependency as { optional?: unknown }).optional === true;
        const target = isOptionalRef ? (dependency as { token: unknown }).token : dependency;

        if (target === INQUIRER || target === MODULE_REF_OWNER) continue;

        const unwrapped = unwrapToken(target as never);

        if (!unwrapped) continue;

        if (!this.graph.getNode(unwrapped) && typeof unwrapped === "function") {
          this.#scanProvider(unwrapped);
        }

        if (!isOptionalRef || instanceOfForwardRefDependency(target)) {
          this.graph.addEdge(nodeToken, unwrapped, GraphEdgeTypeEnum.DEPENDENCY);
        }
      }
    }
  }

  #resolveToken(dependency: any): ConstructorType | string | null {
    if (instanceOfForwardRefDependency(dependency)) {
      return dependency.forwardRef();
    }

    if (typeof dependency === "string" || typeof dependency === "function") {
      return dependency;
    }

    return null;
  }
}
