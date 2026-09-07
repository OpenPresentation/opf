// Keep the site reference tied to exactly the schemas used by the local editor.
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {opfSchemas,listSchemaFields} from '../../opf-editor/src/schema.js';
const schemas=opfSchemas,fields=listSchemaFields(),digest=createHash('sha256').update(JSON.stringify(schemas)).digest('hex');
const payload={schemaDigest:digest,fieldCount:fields.length,schemas,fields};
await mkdir(new URL('../artifacts/spec/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/spec/opf-spec.json',import.meta.url),JSON.stringify(payload));
console.log(`Spec reference: ${Object.keys(schemas).length} schemas, ${fields.length} property definitions, SHA-256 ${digest.slice(0,12)}`);
