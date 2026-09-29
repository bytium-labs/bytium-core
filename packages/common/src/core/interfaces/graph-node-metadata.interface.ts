import { BytiumResourceOptions } from "@core/decorators/bytium-resource.decorator";
import { BytiumResourceModuleOptions } from "@core/decorators/bytium-resource-module.decorator";
import { CustomProviderConfigType } from "@core/types/custom-provider-config.type";
import { PropertyInjectionInterface } from "@core/interfaces/property-injection.interface";
import { ConstructorType } from "@shared";

export interface GraphNodeMetadataInterface {
  options?: BytiumResourceOptions | BytiumResourceModuleOptions;
  constructorParams?: (ConstructorType | string | symbol)[];
  isGlobal?: boolean;
  moduleClass?: ConstructorType;
  customProvider?: CustomProviderConfigType;
  multiMembers?: symbol[];
  transferableName?: string;
  forwardRefParams?: number[];
  optionalParams?: number[];
  propertyInjections?: PropertyInjectionInterface[];
}
