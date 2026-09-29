/**
 * Minimal validation-schema contract - any object with a `validate(value) -> { value, error }` method (Joi, Zod, ...).
 */
export interface ConfigValidationSchema {
  validate(input: Record<string, any>): { value?: Record<string, any>; error?: unknown };
}
