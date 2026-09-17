export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type JsonSchema = JsonObject;

/**
 * Structural shape of a bundled JSON Schema document (the schema itself, not
 * data validated against it). Kept intentionally loose — `$id`/`$schema` are
 * typed precisely because callers rely on them (see `src/validator.ts`), and
 * everything else falls through the index signature. This avoids inferring a
 * deeply-nested literal type for every property/subschema, which is what
 * previously made `dist/schemas.d.ts` balloon to hundreds of KB.
 */
export interface JsonSchemaDocument extends JsonObject {
  readonly $id: string;
  readonly $schema: string;
}
