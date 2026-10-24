// The schema helpers moved to core (`@openpresentation/opf/schema`), where the CLI, agents and every editor read the schemas one way. This module
// keeps the editor's exports.
import { schemas } from '@openpresentation/opf';
export { activeSchema, createSchemaValue, listSchemaFields, resolveSchema, schemaAtPath, schemaLabel, schemaType, schemaVariants } from '@openpresentation/opf/schema';
export const opfSchemas = schemas;
