import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { DependencyGraph } from "@core/graphs/dependency.graph";
import { HandlerInvoker } from "@core/invokers/handler.invoker";
import { CanActivate } from "@core/interfaces/can-activate.interface";
import { ExceptionFilter } from "@core/interfaces/exception-filter.interface";
import { HandlerPipeline } from "@core/interfaces/handler-pipeline.interface";
import { Interceptor } from "@core/interfaces/interceptor.interface";
import { ParamDecoratorEntryInterface } from "@core/interfaces/param-decorator-entry.interface";
import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { ValidationPipe } from "@core/pipes/validation.pipe";
import { GraphNodeModel } from "@core/models/graph-node.model";
import { HandlerEnhancerResolver } from "@core/interfaces/handler-enhancer-resolver.interface";
import { CitizenFXRegistriesInterface } from "@citizenfx/interfaces/citizenfx-registries.interface";
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  APP_PIPE,
  BytiumMetadataEnum,
  BytiumMethodTypeEnum,
  ConstructorType,
} from "@shared";
import { REQUEST_LIKE_METHOD_TYPES } from "@shared/consts/request-like-method-types.const";
import { Logger } from "@logger";

export class HandlerRegistrar {
  readonly #logger = new Logger("bytium");

  constructor(
    private readonly graph: DependencyGraph,
    private readonly citizenFXRegistries: CitizenFXRegistriesInterface,
    private readonly resolver: HandlerEnhancerResolver,
  ) {}

  async registerControllerPipeline(target: ConstructorType, methodName: string): Promise<void> {
    const handlerInvoker = this.graph.getNode(HandlerInvoker)?.instances[0]?.instance as HandlerInvoker;
    const ownerModule = this.graph.getNode(target)?.owner;

    if (!handlerInvoker || !ownerModule) return;

    const source = Object.create(target.prototype) as Record<string, unknown>;
    const pipeline = await this.#resolveHandlerPipeline(source, methodName, ownerModule);

    if (HandlerRegistrar.#hasPipelineComponents(pipeline)) {
      handlerInvoker.registerClassPipeline(target, methodName, pipeline);
    }
  }

  async register(
    instance: Record<string, unknown>,
    target: ConstructorType,
    ownerModule: GraphNodeModel,
  ): Promise<void> {
    const handlerInvoker = this.graph.getNode(HandlerInvoker)?.instances[0]?.instance as HandlerInvoker;
    const methodNames: string[] = [];
    let currentPrototype = target.prototype;

    while (currentPrototype && currentPrototype !== Object.prototype) {
      for (const key of Reflect.ownKeys(currentPrototype)) {
        if (
          typeof instance[key as string] === "function" &&
          key !== "constructor" &&
          !methodNames.includes(key as string)
        ) {
          methodNames.push(key as string);
        }
      }

      currentPrototype = Object.getPrototypeOf(currentPrototype);
    }

    const isController = this.graph.getNode(target)?.type === BytiumDependencyTypeEnum.CONTROLLER;

    for (const methodName of methodNames) {
      const methodType: BytiumMethodTypeEnum = Reflect.getMetadata(
        BytiumMetadataEnum.METHOD_TYPE,
        instance,
        methodName,
      );

      if (methodType && REQUEST_LIKE_METHOD_TYPES.has(methodType) && !isController) {
        this.#logger.warn(
          `Handler "${methodName}" on "${target.name}" is a controller handler but "${target.name}" is not a @Controller - it was ignored. Register "${target.name}" as a @Controller in the controllers array.`,
        );

        continue;
      }

      const methodOptions = Reflect.getMetadata(BytiumMetadataEnum.METHOD_OPTIONS, instance, methodName);
      const registries = this.citizenFXRegistries;

      if (methodType) {
        const pipeline = await this.#resolveHandlerPipeline(instance, methodName, ownerModule);

        if (HandlerRegistrar.#hasPipelineComponents(pipeline)) {
          handlerInvoker.registerPipeline(instance, methodName, pipeline);
        }
      }

      switch (methodType) {
        case BytiumMethodTypeEnum.CALLBACK:
          registries.callbacksRegistry.registerCallback(instance, methodName, methodOptions, target, handlerInvoker);
          break;
        case BytiumMethodTypeEnum.COMMAND:
          registries.commandsRegistry.registerCommand(instance, methodName, methodOptions, target, handlerInvoker);
          break;
        case BytiumMethodTypeEnum.CRON:
          registries.cronJobsRegistry.registerCronJob(instance, methodName, methodOptions, target, handlerInvoker);
          break;
        case BytiumMethodTypeEnum.NET_CALLBACK:
          registries.callbacksRegistry.registerNetCallback(instance, methodName, methodOptions, target, handlerInvoker);
          break;
        case BytiumMethodTypeEnum.ON_CLIENT_RESOURCE_START:
          registries.eventsRegistry.registerClientResourceStartEventListener(
            instance,
            methodName,
            methodOptions,
            target,
            handlerInvoker,
          );
          break;
        case BytiumMethodTypeEnum.ON_CLIENT_RESOURCE_STOP:
          registries.eventsRegistry.registerClientResourceStopEventListener(
            instance,
            methodName,
            methodOptions,
            target,
            handlerInvoker,
          );
          break;
        case BytiumMethodTypeEnum.ON_CONSOLE_OUTPUT:
          registries.eventsRegistry.registerConsoleOutputListener(
            instance,
            methodName,
            methodOptions,
            target,
            handlerInvoker,
          );
          break;
        case BytiumMethodTypeEnum.ON_CONVAR_CHANGE:
          registries.eventsRegistry.registerConvarChangeListener(
            instance,
            methodName,
            methodOptions,
            target,
            handlerInvoker,
          );
          break;
        case BytiumMethodTypeEnum.ON_EVENT:
          registries.eventsRegistry.registerEventListener(instance, methodName, methodOptions, target, handlerInvoker);
          break;
        case BytiumMethodTypeEnum.ON_GAME_EVENT:
          registries.eventsRegistry.registerGameEventListener(
            instance,
            methodName,
            methodOptions,
            target,
            handlerInvoker,
          );
          break;
        case BytiumMethodTypeEnum.ON_NET_EVENT:
          registries.eventsRegistry.registerNetEventListener(
            instance,
            methodName,
            methodOptions,
            target,
            handlerInvoker,
          );
          break;
        case BytiumMethodTypeEnum.ON_RESOURCE_START:
          registries.eventsRegistry.registerResourceStartEventListener(
            instance,
            methodName,
            methodOptions,
            target,
            handlerInvoker,
          );
          break;
        case BytiumMethodTypeEnum.ON_RESOURCE_STOP:
          registries.eventsRegistry.registerResourceStopEventListener(
            instance,
            methodName,
            methodOptions,
            target,
            handlerInvoker,
          );
          break;
        case BytiumMethodTypeEnum.ON_SERVER_RESOURCE_START:
          registries.eventsRegistry.registerServerResourceStartEventListener(
            instance,
            methodName,
            methodOptions,
            target,
            handlerInvoker,
          );
          break;
        case BytiumMethodTypeEnum.ON_SERVER_RESOURCE_STOP:
          registries.eventsRegistry.registerServerResourceStopEventListener(
            instance,
            methodName,
            methodOptions,
            target,
            handlerInvoker,
          );
          break;
        case BytiumMethodTypeEnum.KEY_BIND:
          registries.keyBindsRegistry.registerKeyBind(instance, methodName, methodOptions, target, handlerInvoker);
          break;
        case BytiumMethodTypeEnum.NUI_CALLBACK:
          registries.nuiCallbacksRegistry.registerNUICallback(
            instance,
            methodName,
            methodOptions,
            target,
            handlerInvoker,
          );
          break;
        case BytiumMethodTypeEnum.TICK:
          registries.ticksRegistry.registerTick(instance, methodName, methodOptions, target);
          break;
      }
    }
  }

  async #resolveHandlerPipeline(
    source: Record<string, unknown>,
    methodName: string,
    ownerModule: GraphNodeModel,
  ): Promise<HandlerPipeline> {
    const guards = await this.#resolveHandlerComponents<CanActivate>(
      APP_GUARD,
      BytiumMetadataEnum.GUARDS,
      source,
      methodName,
      ownerModule,
    );
    const pipes = await this.#resolveHandlerComponents<PipeTransform>(
      APP_PIPE,
      BytiumMetadataEnum.PIPES,
      source,
      methodName,
      ownerModule,
    );
    const paramPipes = await this.#resolveParamPipes(source, methodName, ownerModule);
    const interceptors = await this.#resolveHandlerComponents<Interceptor>(
      APP_INTERCEPTOR,
      BytiumMetadataEnum.INTERCEPTORS,
      source,
      methodName,
      ownerModule,
    );
    const filters = (
      await this.#resolveHandlerComponents<ExceptionFilter>(
        APP_FILTER,
        BytiumMetadataEnum.FILTERS,
        source,
        methodName,
        ownerModule,
      )
    ).map((filter) => ({
      filter,
      exceptions: (Reflect.getMetadata(BytiumMetadataEnum.CATCH, filter.constructor) ?? []) as ConstructorType[],
    }));

    return { guards, pipes, paramPipes, interceptors, filters };
  }

  async #resolveHandlerComponents<T>(
    appToken: symbol,
    metadataKey: BytiumMetadataEnum,
    instance: Record<string, unknown>,
    methodName: string,
    ownerModule: GraphNodeModel,
  ): Promise<T[]> {
    const globals = this.graph.getNode(appToken)
      ? ((await this.resolver.resolveDependency(appToken, ownerModule, null)) as T[])
      : [];
    const classLevel: ConstructorType[] = Reflect.getMetadata(metadataKey, instance.constructor) ?? [];
    const methodLevel: ConstructorType[] = Reflect.getMetadata(metadataKey, instance, methodName) ?? [];
    const locals: T[] = [];

    for (const componentClass of [...classLevel, ...methodLevel]) {
      const component = this.graph.getNode(componentClass)
        ? await this.resolver.resolveDependency(componentClass, ownerModule, null)
        : await this.resolver.createInstance(componentClass, ownerModule);

      locals.push(component as T);
    }

    return [...globals, ...locals];
  }

  async #resolveParamPipes(
    instance: Record<string, unknown>,
    methodName: string,
    ownerModule: GraphNodeModel,
  ): Promise<(PipeTransform[] | undefined)[]> {
    const entries: (ParamDecoratorEntryInterface | undefined)[] =
      Reflect.getMetadata(BytiumMetadataEnum.PARAM_DECORATORS, Object.getPrototypeOf(instance), methodName) ?? [];
    const paramPipes: (PipeTransform[] | undefined)[] = [];

    for (let index = 0; index < entries.length; index++) {
      const authored = entries[index]?.pipes;

      if (!authored?.length) continue;

      const resolved: PipeTransform[] = [];

      for (const pipe of authored) {
        if (typeof pipe === "function") {
          const resolvedPipe = this.graph.getNode(pipe)
            ? await this.resolver.resolveDependency(pipe, ownerModule, null)
            : await this.resolver.createInstance(pipe, ownerModule);

          resolved.push(resolvedPipe as PipeTransform);
        } else if ("~standard" in pipe) {
          resolved.push(new ValidationPipe(pipe));
        } else {
          resolved.push(pipe);
        }
      }

      paramPipes[index] = resolved;
    }

    return paramPipes;
  }

  static #hasPipelineComponents(pipeline: HandlerPipeline): boolean {
    return Boolean(
      pipeline.guards?.length ||
      pipeline.pipes?.length ||
      pipeline.interceptors?.length ||
      pipeline.filters?.length ||
      pipeline.paramPipes?.some(Boolean),
    );
  }
}
