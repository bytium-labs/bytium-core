import { BytiumMetadataEnum, ConstructorType } from "@shared";
import { BytiumDependencyTypeEnum } from "@core/enums/bytium-dependency-type.enum";
import { BytiumProviderScopeEnum } from "@core/enums/bytium-provider-scope.enum";

/**
 * Options for `@Injectable()`.
 */
export class InjectableOptions {
  /**
   * The scope of the injectable class.
   *
   * @default BytiumProviderScopeEnum.SINGLETON
   */
  scope?: BytiumProviderScopeEnum = BytiumProviderScopeEnum.SINGLETON;
}

/**
 * Marks a class as a provider. Singleton by default; pass `TRANSIENT` for a fresh instance per injection.
 *
 * @param scope Provider scope.
 */
export function Injectable(scope?: BytiumProviderScopeEnum): <T extends ConstructorType>(constructor: T) => T;
/**
 * Marks a class as a provider. Singleton by default; pass `TRANSIENT` for a fresh instance per injection.
 *
 * @param options \@Injectable() decorator options.
 */
export function Injectable(options?: InjectableOptions): <T extends ConstructorType>(constructor: T) => T;
export function Injectable(a?: BytiumProviderScopeEnum | InjectableOptions) {
  const injectableOptions = new InjectableOptions();

  Object.assign(injectableOptions, typeof a === "string" ? { scope: a } : a);

  return function <T extends ConstructorType>(constructor: T) {
    Reflect.defineMetadata(BytiumMetadataEnum.DEPENDENCY_TYPE, BytiumDependencyTypeEnum.PROVIDER, constructor);
    Reflect.defineMetadata(
      BytiumMetadataEnum.DEPENDENCY_SCOPE,
      injectableOptions?.scope ?? BytiumProviderScopeEnum.SINGLETON,
      constructor,
    );

    return constructor;
  };
}
