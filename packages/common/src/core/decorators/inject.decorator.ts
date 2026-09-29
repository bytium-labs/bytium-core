import { ForwardRefDependencyInterface } from "@core/interfaces/forward-ref-dependency.interface";
import { PropertyInjectionInterface } from "@core/interfaces/property-injection.interface";
import { InvalidInjectException } from "@core/exceptions/invalid-inject.exception";
import { BytiumMetadataEnum, ConstructorType } from "@shared";

/**
 * Options for `@Inject()`.
 */
export class InjectOptions {
  /** Provider token to inject. */
  provider: ConstructorType | ForwardRefDependencyInterface | string | symbol;
}

/**
 * Inject a provider into a class property using the property's TypeScript type as the token.
 *
 * @example
 * ```ts
 * class MyService {
 *   @Inject() private dep: SomeService;
 * }
 * ```
 */
export function Inject(): PropertyDecorator;
/**
 * Inject a provider into a constructor parameter or a class property.
 *
 * @param provider Provider class to inject.
 */
export function Inject<T extends ConstructorType>(provider: T): ParameterDecorator & PropertyDecorator;
/**
 * Inject a provider into a constructor parameter or a class property using a forward reference.
 *
 * @param forwardRef Forward reference to the provider to inject.
 */
export function Inject(forwardRef: ForwardRefDependencyInterface): ParameterDecorator & PropertyDecorator;
/**
 * Inject an external provider into a constructor parameter or class property using a string token.
 *
 * @param externalProviderLink String token of the external provider to inject, in the format "resourceName:moduleName:providerName".
 */
export function Inject(externalProviderLink: string): ParameterDecorator & PropertyDecorator;
/**
 * Inject a provider into a constructor parameter or class property using a symbol token.
 *
 * @param symbolToken Symbol token of the provider to inject.
 */
export function Inject(symbolToken: symbol): ParameterDecorator & PropertyDecorator;
export function Inject<T extends ConstructorType>(
  a?: T | ForwardRefDependencyInterface | string | symbol | InjectOptions,
): ParameterDecorator & PropertyDecorator {
  const injectOptions = new InjectOptions();

  Object.assign(injectOptions, typeof a === "object" && "provider" in a ? a : { provider: a });

  return function (target: object, propertyKey: string | symbol | undefined, parameterIndex?: number) {
    if (typeof parameterIndex === "number") {
      const dependencies = Reflect.getMetadata(BytiumMetadataEnum.DESIGN_PARAMTYPES, target) || [];

      dependencies[parameterIndex] = injectOptions.provider;
      Reflect.defineMetadata(BytiumMetadataEnum.DESIGN_PARAMTYPES, dependencies, target);

      return;
    }

    if (propertyKey === undefined) return;

    const token = injectOptions.provider ?? Reflect.getMetadata("design:type", target, propertyKey);

    if (token === undefined) {
      const constructorName = (target as { constructor: ConstructorType }).constructor.name;

      throw new InvalidInjectException(
        `@Inject() on "${constructorName}.${String(propertyKey)}" could not determine a token - ` +
          `its design:type is undefined (usually a circular import). ` +
          `Provide an explicit token (@Inject(Token)) or a forward reference (@Inject(forwardRef(() => Token))).`,
      );
    }

    const constructor = (target as { constructor: ConstructorType }).constructor;
    const propertyInjections: PropertyInjectionInterface[] =
      Reflect.getMetadata(BytiumMetadataEnum.PROPERTY_INJECTIONS, constructor) ?? [];

    if (!propertyInjections.some((entry) => entry.propertyKey === propertyKey)) {
      propertyInjections.push({ propertyKey, token });
      Reflect.defineMetadata(BytiumMetadataEnum.PROPERTY_INJECTIONS, propertyInjections, constructor);
    }
  };
}
