import { ForwardRefDependencyInterface } from "@core/interfaces/forward-ref-dependency.interface";
import { ConstructorType } from "@shared";

export interface PropertyInjectionInterface {
  propertyKey: string | symbol;
  token: ConstructorType | ForwardRefDependencyInterface | string | symbol;
  optional?: boolean;
}
