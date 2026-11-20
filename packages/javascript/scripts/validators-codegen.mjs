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
const { _, getProperty, str, strConcat } = require('ajv/dist/compile/codegen');
const { getErrorPath, schemaRefOrVal, Type } = require('ajv/dist/compile/util');
const ajvNames = require('ajv/dist/compile/names').default;
const ajvErrors = require('ajv/dist/compile/errors');
// esbuild comes with tsup, a devDependency of the package (the other build scripts take it the same way).
const { transformSync } = createRequire(require.resolve('tsup'))('esbuild');

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
 * RR-111: the error each failed keyword adds, built by one function instead of an object literal at every site.
 *
 * Ajv writes each error as `const err = {instancePath, schemaPath, keyword, params, message, schema, parentSchema, data};` and
 * then `if (vErrors === null) vErrors = [err]; else vErrors.push(err); errors++;`. With `verbose` and the inlined references
 * that is some 5,000 sites and about a third of the module, most of it the eight property names. `opfError` takes the same
 * values in the same order and returns the list, so a site is `vErrors = opfError(vErrors, ...); errors++;`. The error object
 * has the same properties, in the same order, with the same values (`propertyName` last, only where Ajv adds it), so the
 * validators' results do not change; test/precompiled-validators.test.mjs compares them with Ajv's own build.
 *
 * Most errors are the plain case: `schemaPath` is the schema's path plus `/keyword`, and `schema` is `parentSchema[keyword]`
 * (Ajv writes it as that very property access, or as the literal when the value is a number, boolean or string). Those sites
 * call `opfKeywordError`, which leaves both out and builds them from the path, the keyword and `parentSchema` at run time: the
 * same string and the same value (a property read of the same object). The generator decides this per site from the values
 * Ajv compiles (`plainKeyword`); every other error goes through `opfError` with Ajv's values as they are. Three common keywords
 * also take `params` and `message` from the schema or the property name: `opfTypeError` (one type), `opfPatternError` and
 * `opfRequiredError`, each chosen only when Ajv's own params and message code equal what the helper builds. The remaining constant
 * keywords and messages are module constants (`shared`) instead of a literal at each site.
 *
 * Only the sites that add an error to the list (`allErrors`, or inside a composite rule) are written this way, and only when
 * errors are created with messages and verbose values; every other site is Ajv's own code. Ajv has no option for this, so
 * `withErrorHelper` replaces its `reportError` and `reportExtraError` (compile/errors.js, which every keyword calls through the
 * module's exports) while this module generates, and restores them after. test/precompiled-validators-errors.test.mjs checks that
 * every error equals Ajv's runtime error property by property, in order; the generator fails if no site was written this way.
 */
// Their sources are written into the generated module as they are; Ajv also calls them while it checks the schemas against its
// meta-schema at build time.
function opfError(list, instancePath, schemaPath, keyword, params, message, schema, parentSchema, data, propertyName) {
  const error = { instancePath, schemaPath, keyword, params, message, schema, parentSchema, data };
  if (propertyName !== undefined) error.propertyName = propertyName;
  if (list === null) return [error];
  list.push(error);
  return list;
}
function opfKeywordError(list, instancePath, path, keyword, params, message, parentSchema, data, propertyName) {
  return opfError(list, instancePath, `${path}/${keyword}`, keyword, params, message, parentSchema[keyword], parentSchema, data, propertyName);
}
function opfTypeError(list, instancePath, path, parentSchema, data, propertyName) {
  const type = parentSchema.type;
  return opfError(list, instancePath, `${path}/type`, 'type', { type }, `must be ${type}`, type, parentSchema, data, propertyName);
}
function opfPatternError(list, instancePath, path, parentSchema, data, propertyName) {
  const pattern = parentSchema.pattern;
  return opfError(list, instancePath, `${path}/pattern`, 'pattern', { pattern }, `must match pattern "${pattern}"`, pattern, parentSchema, data, propertyName);
}
function opfRequiredError(list, instancePath, path, missingProperty, parentSchema, data, propertyName) {
  return opfError(list, instancePath, `${path}/required`, 'required', { missingProperty }, `must have required property '${missingProperty}'`, parentSchema.required, parentSchema, data, propertyName);
}

/** True when the error's `schema` is `parentSchema[keyword]` and its schema path the schema's path plus the keyword. */
function plainKeyword(cxt, errorPaths) {
  const { keyword, schema, schemaValue, it } = cxt;
  if (errorPaths.parentSchema || errorPaths.schemaPath || typeof it.errSchemaPath !== 'string' || keyword === '$ref') return false;
  if (!isObject(it.schema) || !Object.hasOwn(it.schema, keyword) || it.schema[keyword] !== schema) return false;
  // Ajv writes the value as the literal (schemaRefOrVal) or as the property of the parent schema (the type error does).
  const value = String(schemaValue);
  return value === String(schemaRefOrVal(it, schema, keyword, cxt.$data)) || value === String(_`${it.topSchemaRef}${it.schemaPath}${getProperty(keyword)}`);
}

/** The helper and its arguments for one error: Ajv's error object values (compile/errors.js errorObject), in its order, as code. */
function errorCall(cxt, error, errorPaths = {}) {
  const { keyword, data, schemaValue, it } = cxt;
  const { errorPath, errSchemaPath, propertyName, topSchemaRef, schemaPath } = it;
  const instancePath = strConcat(ajvNames.instancePath, errorPaths.instancePath ? str`${errorPath}${getErrorPath(errorPaths.instancePath, Type.Str)}` : errorPath);
  const params = typeof error.params === 'function' ? error.params(cxt) : error.params || _`{}`;
  const message = typeof error.message === 'function' ? error.message(cxt) : error.message;
  const parentSchema = _`${topSchemaRef}${schemaPath}`;
  const named = propertyName ? [propertyName] : [];
  if (plainKeyword(cxt, errorPaths)) {
    // A type error of one type: `{type}` and `must be ${type}` from the schema (Ajv's message is a string here, or the code of one).
    if (keyword === 'type' && typeof cxt.schema === 'string' && String(params) === String(_`{type: ${cxt.schema}}`) && String(_`${message}`) === String(_`${`must be ${cxt.schema}`}`))
      return { helper: opfTypeError, values: [instancePath, errSchemaPath, parentSchema, data, ...named] };
    // A pattern error: `{pattern}` and `must match pattern "${pattern}"` from the schema (Ajv writes the message as a
    // concatenation of literals, so it is compared with the same concatenation of the schema's pattern).
    if (keyword === 'pattern' && typeof cxt.schema === 'string' && String(params) === String(_`{pattern: ${cxt.schema}}`) && String(_`${message}`) === String(str`must match pattern "${_`${cxt.schema}`}"`))
      return { helper: opfPatternError, values: [instancePath, errSchemaPath, parentSchema, data, ...named] };
    // A required error: `{missingProperty}` and `must have required property '${missingProperty}'` from the property's name.
    const missing = cxt.params?.missingProperty;
    if (keyword === 'required' && missing !== undefined && String(params) === String(_`{missingProperty: ${missing}}`) && String(_`${message}`) === String(str`must have required property '${missing}'`))
      return { helper: opfRequiredError, values: [instancePath, errSchemaPath, missing, parentSchema, data, ...named] };
    return { helper: opfKeywordError, values: [instancePath, errSchemaPath, shared(it.gen, keyword), params, shared(it.gen, message), parentSchema, data, ...named] };
  }
  let errorSchemaPath = errorPaths.parentSchema ? errSchemaPath : str`${errSchemaPath}/${keyword}`;
  if (errorPaths.schemaPath) errorSchemaPath = str`${errorSchemaPath}${getErrorPath(errorPaths.schemaPath, Type.Str)}`;
  return { helper: opfError, values: [instancePath, errorSchemaPath, shared(it.gen, keyword), params, shared(it.gen, message), schemaValue, parentSchema, data, ...named] };
}

/**
 * A constant string (a keyword, or a message without data in it) as one module constant that every error refers to, instead of
 * the literal at each site; any other code as it is. The value is the same string.
 */
function shared(gen, value) {
  let text = value;
  if (typeof value !== 'string') {
    const code = String(value);
    if (!/^"(?:[^"\\]|\\.)*"$/.test(code)) return value;
    text = JSON.parse(code);
  }
  if (text.length < 3) return value;
  return gen.scopeValue('obj', { key: text, ref: text, code: _`${text}` });
}

/** Runs `generate` with Ajv's reportError and reportExtraError writing a call of `opfError` where they would add an error to the list. */
function withErrorHelper(generate) {
  const { reportError, reportExtraError, keywordError } = ajvErrors;
  const helped = (cxt) => cxt.it.createErrors !== false && cxt.it.opts.messages && cxt.it.opts.verbose;
  const add = (cxt, error, errorPaths) => {
    const { gen } = cxt.it;
    const call = errorCall(cxt, error, errorPaths);
    const helper = gen.scopeValue('func', { ref: call.helper, code: new _Code(call.helper.name) });
    const args = call.values.reduce((code, value) => _`${code}, ${value}`);
    gen.assign(ajvNames.vErrors, _`${helper}(${ajvNames.vErrors}, ${args})`);
    gen.code(_`${ajvNames.errors}++`);
  };
  ajvErrors.reportError = (cxt, error = keywordError, errorPaths, overrideAllErrors) => {
    const { compositeRule, allErrors } = cxt.it;
    if (!helped(cxt) || !(overrideAllErrors ?? (compositeRule || allErrors))) return reportError(cxt, error, errorPaths, overrideAllErrors);
    add(cxt, error, errorPaths);
  };
  ajvErrors.reportExtraError = (cxt, error = keywordError, errorPaths) => {
    const { compositeRule, allErrors } = cxt.it;
    if (!helped(cxt) || !(compositeRule || allErrors)) return reportExtraError(cxt, error, errorPaths);
    add(cxt, error, errorPaths);
  };
  try {
    return generate();
  } finally {
    Object.assign(ajvErrors, { reportError, reportExtraError });
  }
}

/**
 * @param {Record<string, object>} schemas the registered schemas by name, in the order `schemas.ts` lists them
 * @returns {string} the source of src/generated/precompiled-validators.ts
 */
export function precompiledValidatorsSource(schemas) {
  return withErrorHelper(() => generateSource(schemas));
}

function generateSource(schemas) {
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
  // Each helper is referred to once per validator scope (`const func3 = opfKeywordError;`); Ajv's own error literals are gone.
  for (const helper of [opfError, opfKeywordError, opfTypeError, opfPatternError, opfRequiredError])
    if (!body.includes(`= ${helper.name};`)) throw new Error(`No error of the generated validators is built by ${helper.name}: Ajv's error reporting changed (see withErrorHelper).`);
  if (/[{,]schemaPath:/.test(body)) throw new Error('The generated validators still build an error object literal: Ajv reports some error outside withErrorHelper.');
  if (/\bnew Function\b|\beval\s*\(|\bFunction\s*\(/.test(body)) throw new Error('The generated validators still generate code at runtime.');
  if (/\bconst schema\d+ = [{[]/.test(body)) throw new Error('The generated validators still embed a copy of a schema.');

  const table = (list, entry) => list.map((item) => `  ${entry(item)},`).join('\n');
  const source = `import { schemas } from "./schemas.js";

const exports = {};
${opfError}
${opfKeywordError}
${opfTypeError}
${opfPatternError}
${opfRequiredError}
${body}
export const rootValidators = {
${table(roots, (item) => `${JSON.stringify(item.schemaName)}: exports.${item.name}`)}
};
export const definitionValidators = {
${table(definitions, (item) => `${JSON.stringify(`${item.schemaName}#/$defs/${item.definition}`)}: exports.${item.name}`)}
};
export const branchValidators = [
${table(branches, (item) => `{ schema: ${JSON.stringify(item.schemaName)}, pointer: ${JSON.stringify(item.pointer)}, validate: exports.${item.name} }`)}
];
`;
  // The code is generated for machines and ships in the package (an edge host loads all of it), so it is minified: about half the size.
  // Names are free to change: an error's `parentSchema` is the object itself (an expression into `schemas`), found by identity,
  // and property names (`instancePath`, `schemaPath`, `parentSchema`, ...) are never renamed. The checks run on the output.
  const minified = transformSync(source, { loader: 'js', format: 'esm', target: 'es2022', minify: true, legalComments: 'none' }).code;
  if (/\bnew Function\b|\beval\s*\(|\bFunction\s*\(/.test(minified)) throw new Error('The minified validators generate code at runtime.');
  for (const [name, schema] of Object.entries(schemas)) {
    const text = typeof schema.description === 'string' ? schema.description.split(/["\\\n]/)[0].slice(0, 80) : '';
    if (text.length > 40 && minified.includes(text)) throw new Error(`The minified validators embed the description of the ${name} schema, so they hold a copy of it.`);
  }
  return `// @ts-nocheck
// Generated by scripts/generate.mjs (scripts/validators-codegen.mjs) from spec/schemas/*.schema.json with Ajv standalone code
// generation (CE-01), then minified. Do not edit by hand. These validators never compile code at runtime. ${replaced} schema constants refer to
// the bundled schemas, so \`parentSchema\` of an error is the object \`validate\` knows.
// rootValidators: one per registered schema, by schema name. definitionValidators: named definitions, by \`schemaName#/$defs/definition\`.
// branchValidators: one per oneOf/anyOf branch, with its place in the schemas (qualified like src/branch-schema.ts).
${minified}`;
}
