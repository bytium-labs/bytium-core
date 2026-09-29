import { ConstructorType } from "@shared";

export interface ScopeMapsInterface {
  moduleProviders: Map<ConstructorType | string | symbol, Set<ConstructorType | string | symbol>>;
  moduleExports: Map<ConstructorType | string | symbol, Set<ConstructorType | string | symbol>>;
  moduleImports: Map<ConstructorType | string | symbol, (ConstructorType | string | symbol)[]>;
  globalProviders: Set<ConstructorType | string | symbol>;
  resourceExternalImports: Map<ConstructorType | string | symbol, Set<string>>;
  providerOwnerModules: Map<ConstructorType | string | symbol, Set<ConstructorType | string | symbol>>;
  moduleOwnerResource: Map<ConstructorType | string | symbol, ConstructorType | string | symbol>;
}
