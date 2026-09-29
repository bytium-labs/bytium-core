import { BytiumResourceDynamicModuleInterface } from "@core/interfaces/bytium-resource-dynamic-module.interface";

const MODULE_TOKEN_KEY = Symbol.for("bytium:dynamicModuleToken");
let counter = 0;

export function getOrCreateModuleToken(dynamicModule: BytiumResourceDynamicModuleInterface): symbol {
  const cached = (dynamicModule as unknown as Record<symbol, symbol>)[MODULE_TOKEN_KEY];

  if (cached) return cached;

  const token = Symbol(`${dynamicModule.module.name}#${++counter}`);

  Object.defineProperty(dynamicModule, MODULE_TOKEN_KEY, {
    value: token,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return token;
}
