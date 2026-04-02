import { toJSONSchema, type ZodType } from "zod";

export function toJsonSchema(schema: ZodType): Record<string, unknown> {
  const jsonSchema = toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}
