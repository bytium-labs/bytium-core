import { StandardSchemaV1 } from "@core/interfaces/standard-schema.interface";
import { SchemaFieldPathsType } from "@core/types/schema-field-paths.type";
import { SENSITIVE_SCHEMA_PATHS } from "@shared/consts/sensitive-schema-paths.const";

/** Wraps a Standard Schema so the listed dot paths (`*` = every key/element) are masked as `[REDACTED]` in logs; validation is untouched and the paths are type-checked against the schema output. */
export function sensitive<TSchema extends StandardSchemaV1>(
  schema: TSchema,
  paths: SchemaFieldPathsType<TSchema>[],
): TSchema {
  const maskedPaths = [...paths];

  // Proxy, not Object.create: ArkType schemas are callable
  return new Proxy(schema, {
    get(target, property) {
      return property === SENSITIVE_SCHEMA_PATHS ? maskedPaths : Reflect.get(target, property);
    },
  });
}
