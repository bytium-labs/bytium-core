import { StandardSchemaV1 } from "@core/interfaces/standard-schema.interface";

type PrimitiveLeaf = string | number | boolean | bigint | symbol | null | undefined | Date;

type JoinPath<TKey extends string, TSub> = TSub extends string ? `${TKey}.${TSub}` : never;

type FieldPaths<TValue, TDepth extends unknown[]> = TDepth["length"] extends 6
  ? never
  : TValue extends PrimitiveLeaf
    ? never
    : TValue extends (...args: never[]) => unknown
      ? never
      : TValue extends ReadonlyArray<infer TElement>
        ? "*" | JoinPath<"*", FieldPaths<NonNullable<TElement>, [...TDepth, 1]>>
        : TValue extends object
          ? {
              [TKey in keyof TValue & string]:
                TKey | JoinPath<TKey, FieldPaths<NonNullable<TValue[TKey]>, [...TDepth, 1]>>;
            }[keyof TValue & string]
          : never;

/** Dot paths of the schema's output fields; falls back to `string` for untyped schemas. */
export type SchemaFieldPathsType<TSchema extends StandardSchemaV1> = [StandardSchemaV1.InferOutput<TSchema>] extends [
  never,
]
  ? string
  : unknown extends StandardSchemaV1.InferOutput<TSchema>
    ? string
    : [FieldPaths<NonNullable<StandardSchemaV1.InferOutput<TSchema>>, []>] extends [never]
      ? string
      : FieldPaths<NonNullable<StandardSchemaV1.InferOutput<TSchema>>, []>;
