import { AnyExecutionContext } from "@core/types/any-execution-context.type";
import { PipeTransform } from "@core/interfaces/pipe-transform.interface";
import { StandardSchemaV1 } from "@core/interfaces/standard-schema.interface";
import { ConstructorType } from "@shared";

export interface ParamDecoratorEntryInterface {
  factory: (data: unknown, context: AnyExecutionContext) => unknown;
  data: unknown;
  pipes?: (ConstructorType | PipeTransform | StandardSchemaV1)[];
}
