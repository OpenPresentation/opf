// CE-01: precompiled OPF schema validators.
//
// `validate` checks a document against the OPF JSON Schemas with Ajv. Ajv normally compiles each schema to JavaScript
// with `new Function` the first time it is used, and Cloudflare Workers, Vercel Edge and other hosts refuse code
// generation from strings (and so does a browser page under a strict Content-Security-Policy). This module runs Ajv's
// standalone code generation at build time, with the options, formats and schemas `schema-engine-ajv.ts` uses, and returns
// the source of `src/generated/precompiled-validators.ts`. The `workerd`, `worker`, `edge-light` and `browser` conditions of
// the package's `#schema-engine` import load that file instead of Ajv (package.json `imports`).
//
// What it generates:
//   - a validator for each registered schema (`rootValidators`);
//   - a validator for each named definition the validator checks on its own (`definitionValidators`): the typed variable
//     kinds and the branches of the chart data and table column unions;
//   - a validator for each branch of every `oneOf` and `anyOf` in the schemas (`branchValidators`), which the union error
//     analysis (src/union-errors.ts) runs at runtime in the Ajv build. Each branch is qualified exactly as the Ajv build
//     qualifies it (`qualifyBranch`), so the verdicts and errors agree.
//
// The verbose error objects of Ajv carry `schema` and `parentSchema`, and the validator finds the definition of an error by the
// identity of its `parentSchema` object (src/validation-definitions.ts). Ajv's standalone code embeds a copy of each schema as a
// literal, which would break that lookup and duplicate the schemas in the bundle. So every embedded schema is replaced by an
// expression into the bundled `schemas` object, and the generated validators report the very objects `validate` reads.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020.js').default;
const addFormats = require('ajv-formats').default;
const standaloneCode = require('ajv/dist/standalone').default;
const { _Code } = require('ajv/dist/compile/codegen/code');

/** Definitions of the presentation schema the validator runs on their own (typedVariableErrors, dataUnionErrors). */
const DEFINITIONS = { presentation: (name) => name.endsWith('Variable') || ['DatasetRef', 'ChartData', 'StyledTableCell', 'DataColumn'].includes(name) };

const MAP_KEYWORDS = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']);
const LIST_KEYWORDS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);
const SCHEMA_KEYWORDS = new Set(['items', 'additionalProperties', 'additionalItems', 'unevaluatedItems', 'unevaluatedProperties', 'contains', 'propertyNames', 'not', 'if', 'then', 'else']);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Calls `visit(schema, pointer)` for every subschema of `schema` (not for data such as `enum` and `examples`), pointer as path segments. */
function walkSchema(schema, visit, pointer = []) {
  if (!isObject(schema)) return;
  visit(schema, pointer);
  for (const [keyword, value] of Object.entries(schema)) {
    if (MAP_KEYWORDS.has(keyword) && isObject(value)) for (const [name, sub] of Object.entries(value)) walkSchema(sub, visit, [...pointer, keyword, name]);
    else if (LIST_KEYWORDS.has(keyword) && Array.isArray(value)) for (const [index, sub] of value.entries()) walkSchema(sub, visit, [...pointer, keyword, index]);
    else if (SCHEMA_KEYWORDS.has(keyword)) walkSchema(value, visit, [...pointer, keyword]);
  }
}

/**
 * A union branch with its local references (`#/$defs/X`) made absolute, so it compiles on its own. This is the function
 * src/branch-schema.ts runs in the Ajv build; `copies` records each copied node's original, for the identity lookup below.
 */
export function qualifyBranch(node, rootId, copies) {
  if (Array.isArray(node)) {
    const copy = node.map((item) => qualifyBranch(item, rootId, copies));
    copies?.set(copy, node);
    return copy;
  }
  if (node && typeof node === 'object') {
    const copy = {};
    for (const [name, value] of Object.entries(node)) copy[name] = name === '$ref' && typeof value === 'string' && value.startsWith('#') ? rootId + value : qualifyBranch(value, rootId, copies);
    copies?.set(copy, node);
    return copy;
  }
  return node;
}

/** `schemas["presentation"]["$defs"]["X"]`: the expression of every object in the schemas. */
function expressions(schemas) {
  const found = new Map();
  const visit = (node, expression) => {
    if (!node || typeof node !== 'object' || found.has(node)) return;
    found.set(node, expression);
    for (const [key, value] of Object.entries(node)) visit(value, `${expression}[${JSON.stringify(key)}]`);
  };
  for (const [name, schema] of Object.entries(schemas)) visit(schema, `schemas[${JSON.stringify(name)}]`);
  return found;
}

/**
 * Ajv's options for the OPF schemas. Keep them equal to `schema-engine-ajv.ts`: the verbose errors are the input of the union
 * analysis, and `allErrors` decides which errors a document gets. test/precompiled-validators.test.mjs compares the two builds.
 */
export const ajvOptions = { allErrors: true, verbose: true, strict: false, allowUnionTypes: true };

/**
 * @param {Record<string, object>} schemas the registered schemas by name, in the order `schemas.ts` lists them
 * @returns {string} the source of src/generated/precompiled-validators.ts
 */
export function precompiledValidatorsSource(schemas) {
  const ajv = new Ajv2020({ ...ajvOptions, code: { source: true } });
  addFormats(ajv);
  for (const schema of Object.values(schemas)) ajv.addSchema(schema);
  const at = expressions(schemas);

  const exportNames = {};
  const roots = [];
  const definitions = [];
  const branches = [];
  const add = (prefix, list, entry, key) => {
    const name = `${prefix}${list.length}`;
    list.push({ ...entry, name });
    exportNames[name] = key;
  };
  const copies = new Map();
  for (const [schemaName, schema] of Object.entries(schemas)) {
    add('root', roots, { schemaName }, schema.$id);
    walkSchema(schema, (node, pointer) => {
      const tail = pointer.at(-1);
      if (pointer.length === 2 && pointer[0] === '$defs' && DEFINITIONS[schemaName]?.(String(tail)))
        add('definition', definitions, { schemaName, definition: String(tail) }, `${schema.$id}#/$defs/${tail}`);
      for (const keyword of ['oneOf', 'anyOf']) {
        if (!Array.isArray(node[keyword])) continue;
        node[keyword].forEach((branch, index) => {
          if (!isObject(branch)) return;
          const key = `opf-branch-${branches.length}`;
          // Anonymous schemas are registered under a key; the copy has no $id, exactly as in the Ajv build.
          ajv.addSchema(qualifyBranch(branch, schema.$id, copies), key);
          add('branch', branches, { schemaName, pointer: [...pointer, keyword, index] }, key);
        });
      }
    });
  }
  // Compile everything before the schema constants are replaced, so every constant exists.
  for (const key of Object.values(exportNames)) if (!ajv.getSchema(key)) throw new Error(`No validator for ${key}.`);

  // Replace each embedded schema by an expression into `schemas`. The constants are the roots of the compiled schemas:
  // a registered schema, a definition compiled on its own, or the copy of a union branch (which maps back to its original).
  // A constant that stays a literal fails the check below.
  let replaced = 0;
  for (const [reference, name] of ajv.scope._values.schema ?? []) {
    let original = reference;
    while (copies.has(original)) original = copies.get(original);
    const expression = at.get(original);
    // The meta-schema Ajv compiles to check each added schema is in this scope too; no validator uses it.
    if (!expression) continue;
    name.value.code = new _Code(expression);
    replaced++;
  }

  const body = standaloneCode(ajv, exportNames).replace(/^"use strict";/, '');
  if (/\bnew Function\b|\beval\s*\(|\bFunction\s*\(/.test(body)) throw new Error('The generated validators still generate code at runtime.');
  if (/\bconst schema\d+ = [{[]/.test(body)) throw new Error('The generated validators still embed a copy of a schema.');

  const table = (list, entry) => list.map((item) => `  ${entry(item)},`).join('\n');
  return `// @ts-nocheck
// Generated by scripts/generate.mjs (scripts/validators-codegen.mjs) from spec/schemas/*.schema.json with Ajv standalone code
// generation (CE-01). Do not edit by hand. These validators never compile code at runtime. ${replaced} schema constants refer to the
// bundled schemas, so \`parentSchema\` of an error is the object \`validate\` knows.
import { schemas } from "./schemas.js";

const exports = {};
${body}
/** One validator per registered schema, by schema name. */
export const rootValidators = {
${table(roots, (item) => `${JSON.stringify(item.schemaName)}: exports.${item.name}`)}
};

/** Validators of named definitions, by \`schemaName#/$defs/definition\`. */
export const definitionValidators = {
${table(definitions, (item) => `${JSON.stringify(`${item.schemaName}#/$defs/${item.definition}`)}: exports.${item.name}`)}
};

/** One validator per oneOf/anyOf branch, with the branch's place in the schemas (qualified like src/branch-schema.ts). */
export const branchValidators = [
${table(branches, (item) => `{ schema: ${JSON.stringify(item.schemaName)}, pointer: ${JSON.stringify(item.pointer)}, validate: exports.${item.name} }`)}
];
`;
}
