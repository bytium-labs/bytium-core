import { BytiumMetadataEnum, ConstructorType } from "@shared";

/**
 * Declares which exception types an `ExceptionFilter` handles.
 */
export function Catch(...exceptions: ConstructorType[]): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(BytiumMetadataEnum.CATCH, exceptions, target);
  };
}
