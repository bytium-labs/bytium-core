import { PropertyInjectionInterface } from "@core/interfaces/property-injection.interface";
import { BytiumMetadataEnum, ConstructorType } from "@shared";

/**
 * Options for `@Transferable()`.
 */
export class TransferableOptions {
  /** Export name used when transferring this provider to other resources. Defaults to the class name. */
  name?: string;
}

/**
 * Marks a class for transfer across resource boundaries.
 *
 * @param name Export name (see {@link TransferableOptions.name}).
 */
export function Transferable(name?: string): <T extends ConstructorType>(constructor: T) => T;
/**
 * Marks a class for transfer across resource boundaries.
 *
 * @param options \@Transferable() decorator options.
 */
export function Transferable(options?: TransferableOptions): <T extends ConstructorType>(constructor: T) => T;
export function Transferable(a?: string | TransferableOptions): <T extends ConstructorType>(constructor: T) => T {
  const transferableOptions = new TransferableOptions();

  Object.assign(transferableOptions, a && typeof a === "string" ? { name: a } : a);

  return function <T extends ConstructorType>(constructor: T) {
    const transferableConstructor = class extends constructor {
      /** Public marker on a Transferable instance received across resource boundaries - the resource that owns the underlying provider. */
      __ownerResourceName = global.GetCurrentResourceName();

      constructor(...args: any[]) {
        super(...args);

        this.#__bytiumInternalBind();
      }

      #__bytiumInternalBind(): void {
        this.#__bytiumInternalBindMethods();
        this.#__bytiumInternalHideDependencies();
      }

      #__bytiumInternalBindMethods(): void {
        const allMethods = new Set<string>();
        let currentPrototype = Object.getPrototypeOf(this);

        while (currentPrototype && currentPrototype !== Object.prototype) {
          const methodNames = Object.getOwnPropertyNames(currentPrototype).filter(
            (propertyName) =>
              typeof Reflect.get(this, propertyName) === "function" &&
              propertyName !== "constructor" &&
              !propertyName.startsWith("__bytiumInternal"),
          );

          for (const methodName of methodNames) {
            allMethods.add(methodName);
          }

          currentPrototype = Object.getPrototypeOf(currentPrototype);
        }

        for (const methodName of allMethods) {
          const originalMethod = Reflect.get(this, methodName);

          if (typeof originalMethod === "function") {
            Object.defineProperty(this, methodName, {
              value: originalMethod.bind(this),
              writable: false,
              configurable: true,
              enumerable: true,
            });
          }
        }

        const propertyNames = Object.getOwnPropertyNames(this);

        for (const propertyName of propertyNames) {
          const propertyDescriptor = Object.getOwnPropertyDescriptor(this, propertyName);

          if (propertyDescriptor && (propertyDescriptor.get || propertyDescriptor.set)) {
            const originalGet = propertyDescriptor.get;
            const originalSet = propertyDescriptor.set;

            Object.defineProperty(this, propertyName, {
              get: originalGet ? originalGet.bind(this) : undefined,
              set: originalSet ? originalSet.bind(this) : undefined,
              configurable: true,
              enumerable: true,
            });
          }
        }
      }

      #__bytiumInternalHideDependencies(): void {
        const objectKeys = Object.keys(this);

        for (const key of objectKeys) {
          const propertyValue = Reflect.get(this, key);

          if (
            typeof propertyValue === "object" &&
            propertyValue !== null &&
            Reflect.getMetadata(BytiumMetadataEnum.DEPENDENCY_TYPE, propertyValue.constructor)
          ) {
            Object.defineProperty(this, key, {
              value: propertyValue,
              writable: false,
              configurable: false,
              enumerable: false,
            });
          }
        }

        /**
         * Pre-hide @Inject property-level slots by name. The engine assigns their values after
         * this hook runs; `defineProperty` with `writable: true` keeps the descriptor (including
         * `enumerable: false`) preserved across the upcoming simple assignment.
         */
        const propertyInjections = Reflect.getMetadata(BytiumMetadataEnum.PROPERTY_INJECTIONS, this.constructor) as
          PropertyInjectionInterface[] | undefined;

        if (propertyInjections) {
          for (const injection of propertyInjections) {
            Object.defineProperty(this, injection.propertyKey, {
              value: undefined,
              writable: true,
              configurable: true,
              enumerable: false,
            });
          }
        }
      }
    };

    Object.defineProperty(transferableConstructor, "name", {
      value: Object.getOwnPropertyDescriptor(constructor, "name")?.value,
      writable: false,
      configurable: false,
      enumerable: true,
    });

    if (transferableOptions?.name) {
      Reflect.defineMetadata(
        BytiumMetadataEnum.DEPENDENCY_PUBLIC_EXPORT_NAME,
        transferableOptions.name,
        transferableConstructor,
      );
    }

    return transferableConstructor;
  };
}
