import type { CatalogRecordKind } from "./catalog-schemas.js";
import type { SchemaName } from "./schemas.js";

/**
 * Which catalog a reference field points into, kept beside the schemas rather than in them: the published schemas
 * (spec/schemas, openpresentation.org/schema/...) carry no vendor keyword, so any Ajv in strict mode (the default) compiles
 * them without `addKeyword`. `check:schema-strict` keeps it that way.
 *
 * Keys are `<schema name>#<JSON Pointer of the node in that schema document>` (the schema names of `@openpresentation/opf/schemas`);
 * the node is the one at the pointer as written, a `$ref` and its siblings included. Values are the catalog record kind the
 * field references. The annotation never changes validation: `describeField` and `catalogKindAt` read it, nothing else.
 * A test fails when a pointer leaves its schema or a schema reference field is missing here.
 */
export type SchemaNodeKey = `${SchemaName}#/${string}`;

export const schemaCatalogKinds: Readonly<Record<SchemaNodeKey, CatalogRecordKind>> = {
  "presentation#/properties/audience": "audiences",
  "presentation#/properties/audience/oneOf/2/items": "audiences",
  "presentation#/properties/purpose": "purposes",
  "presentation#/properties/tone": "tones",
  "presentation#/properties/narrative": "narratives",
  "presentation#/$defs/Audience/properties/id": "audiences",
  "presentation#/$defs/Purpose/properties/id": "purposes",
  "presentation#/$defs/Language/properties/fontScheme": "fontSchemes",
  "presentation#/$defs/Language/properties/googleFontScheme": "fontSchemes",
  "presentation#/$defs/Tone/properties/id": "tones",
  "presentation#/$defs/Design/properties/theme": "themes",
  "presentation#/$defs/Design/properties/colorScheme": "colorSchemes",
  "presentation#/$defs/Design/properties/fontScheme": "fontSchemes",
  "presentation#/$defs/ColorScheme/properties/id": "colorSchemes",
  "presentation#/$defs/FontScheme/properties/id": "fontSchemes",
  "presentation#/$defs/Slide/properties/layout": "layouts",
  "theme#/properties/colorScheme": "colorSchemes",
  "theme#/properties/fontScheme": "fontSchemes",
};
