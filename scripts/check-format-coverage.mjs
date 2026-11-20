#!/usr/bin/env node
// RR-105: format coverage of the decks that native apps open. Walks every JSON deck of the release qualification corpus
// (scripts/native-acceptance/qualification/manifest.json) along spec/schemas/opf.schema.json and records, per schema location:
//   key     each declared property (and each map's "any other key", additionalProperties) used at least once;
//   value   each enum value and const used, including the enumerated key names of a propertyNames enum;
//   branch  each oneOf / anyOf alternative a value took (a background as a color, a gradient and an image);
//   layout  each layout of the default catalog (packages/gallery/catalog/layouts) named by a slide.
// $ref, allOf, oneOf, anyOf, if/then/else, dependentSchemas, patternProperties, additionalProperties, prefixItems and items
// are followed; locations inside if, then, else, not and dependentSchemas are constraints, not vocabulary, and are not
// counted, nor are alternatives that only require or forbid keys. A location that no deck covers fails the check unless
// scripts/format-coverage-allowlist.json lists it with a reason; an allowlist entry that is covered or that the schema
// no longer has fails too. A schema addition therefore needs a deck that uses it (CONTRIBUTING.md).
//   node scripts/check-format-coverage.mjs            check the corpus; print totals and what is missing
//   node scripts/check-format-coverage.mjs --json     the same as JSON
//   node scripts/check-format-coverage.mjs --files a.opf.json,b.opf.json [--no-allowlist]   measure other decks (report only)
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'packages/javascript/package.json'));

const CONSTRAINT_KEYWORDS = new Set(['if', 'then', 'else', 'not', 'dependentSchemas']);
const escapePointer = (segment) => String(segment).replaceAll('~', '~0').replaceAll('/', '~1');

function nodeAt(schema, pointer) {
  let node = schema;
  for (const raw of pointer.replace(/^#\/?/u, '').split('/').filter(Boolean)) node = node?.[raw.replaceAll('~1', '/').replaceAll('~0', '~')];
  return node;
}

const isConstraintOnly = (branch) => branch && typeof branch === 'object' && Object.keys(branch).every((key) => key === 'required' || key === 'not' || key === 'description');

/** A readable name for a location id: "#/$defs/TextRun/oneOf/1/properties/strikethrough" is "TextRun.oneOf[1].strikethrough". */
export function label(id) {
  const [pointer, value] = id.split('=');
  const parts = pointer.replace(/^#\/?/u, '').split('/').map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
  let out = '';
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === '$defs' && index === 0) continue;
    if (part === 'properties' || part === 'patternProperties') {
      out += `.${parts[++index]}`;
      continue;
    }
    if (['oneOf', 'anyOf', 'allOf', 'prefixItems'].includes(part)) {
      out += `.${part}[${parts[++index]}]`;
      continue;
    }
    if (part === 'items') out += '[]';
    else if (part === 'additionalProperties') out += '.*';
    else if (part === 'propertyNames') out += '.<key>';
    else out += out ? `.${part}` : part;
  }
  out = out.replace(/^\./u, '') || '(document)';
  return value === undefined ? out : `${out} = ${value}`;
}

/** Every countable location of the schema reachable from its root: Map id -> {kind}. */
export function collectLocations(schema) {
  const locations = new Map();
  const seen = new Set();
  const visit = (node, pointer, counted) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    if (seen.has(`${pointer}|${counted}`)) return;
    seen.add(`${pointer}|${counted}`);
    const add = (id, kind) => {
      if (counted) locations.set(id, { kind });
    };
    if (typeof node.$ref === 'string' && node.$ref.startsWith('#')) visit(nodeAt(schema, node.$ref), node.$ref, counted);
    for (const value of node.enum ?? []) add(`${pointer}=${JSON.stringify(value)}`, 'value');
    if ('const' in node) add(`${pointer}=${JSON.stringify(node.const)}`, 'value');
    for (const keyword of ['oneOf', 'anyOf']) {
      const branches = node[keyword];
      if (!Array.isArray(branches)) continue;
      const vocabulary = !branches.every(isConstraintOnly);
      branches.forEach((branch, index) => {
        const id = `${pointer}/${keyword}/${index}`;
        if (vocabulary && branches.length > 1) add(id, 'branch');
        visit(branch, id, counted);
      });
    }
    for (const [index, branch] of (node.allOf ?? []).entries()) visit(branch, `${pointer}/allOf/${index}`, counted);
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      const id = `${pointer}/properties/${escapePointer(key)}`;
      if (child !== false) add(id, 'key');
      visit(child, id, counted);
    }
    for (const [pattern, child] of Object.entries(node.patternProperties ?? {})) {
      const id = `${pointer}/patternProperties/${escapePointer(pattern)}`;
      add(id, 'key');
      visit(child, id, counted);
    }
    if (node.additionalProperties && typeof node.additionalProperties === 'object') {
      const id = `${pointer}/additionalProperties`;
      add(id, 'key');
      visit(node.additionalProperties, id, counted);
    }
    if (node.propertyNames && typeof node.propertyNames === 'object') visit(node.propertyNames, `${pointer}/propertyNames`, counted);
    for (const [index, item] of (node.prefixItems ?? []).entries()) visit(item, `${pointer}/prefixItems/${index}`, counted);
    if (node.items && typeof node.items === 'object') visit(node.items, `${pointer}/items`, counted);
    for (const keyword of CONSTRAINT_KEYWORDS) {
      const child = node[keyword];
      if (!child || typeof child !== 'object') continue;
      if (keyword === 'dependentSchemas') for (const [key, sub] of Object.entries(child)) visit(sub, `${pointer}/dependentSchemas/${escapePointer(key)}`, false);
      else visit(child, `${pointer}/${keyword}`, false);
    }
  };
  visit(schema, '#', true);
  return locations;
}

/** Walks documents along the schema; returns the Set of location ids they use (a superset of countable ids). */
export function walkDocuments(schema, documents) {
  const Ajv = require('ajv/dist/2020.js').default;
  const formats = require('ajv-formats').default;
  const ajv = new Ajv({ strict: false, allErrors: false, allowUnionTypes: true, validateFormats: true });
  formats(ajv);
  const base = schema.$id ?? 'opf-coverage://schema';
  ajv.addSchema({ ...schema, $id: base });
  const validators = new Map();
  const matches = (pointer, value) => {
    let validate = validators.get(pointer);
    if (!validate) {
      validate = ajv.compile({ $ref: `${base}${pointer}` });
      validators.set(pointer, validate);
    }
    return validate(value);
  };
  const used = new Set();
  const walk = (value, node, pointer) => {
    if (node === true || !node || typeof node !== 'object') return;
    if (typeof node.$ref === 'string' && node.$ref.startsWith('#')) walk(value, nodeAt(schema, node.$ref), node.$ref);
    if (Array.isArray(node.enum) && node.enum.some((entry) => JSON.stringify(entry) === JSON.stringify(value))) used.add(`${pointer}=${JSON.stringify(value)}`);
    if ('const' in node && JSON.stringify(node.const) === JSON.stringify(value)) used.add(`${pointer}=${JSON.stringify(node.const)}`);
    for (const [index, branch] of (node.allOf ?? []).entries()) walk(value, branch, `${pointer}/allOf/${index}`);
    for (const keyword of ['oneOf', 'anyOf']) {
      (node[keyword] ?? []).forEach((branch, index) => {
        const id = `${pointer}/${keyword}/${index}`;
        if (!matches(id, value)) return;
        used.add(id);
        walk(value, branch, id);
      });
    }
    if (node.if !== undefined) {
      if (matches(`${pointer}/if`, value)) walk(value, node.then, `${pointer}/then`);
      else walk(value, node.else, `${pointer}/else`);
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, sub] of Object.entries(node.dependentSchemas ?? {})) if (key in value) walk(value, sub, `${pointer}/dependentSchemas/${escapePointer(key)}`);
      const properties = node.properties ?? {};
      const patterns = Object.entries(node.patternProperties ?? {}).map(([pattern, child]) => [new RegExp(pattern, 'u'), pattern, child]);
      for (const [key, child] of Object.entries(value)) {
        if (node.propertyNames && Array.isArray(node.propertyNames.enum) && node.propertyNames.enum.includes(key)) used.add(`${pointer}/propertyNames=${JSON.stringify(key)}`);
        let declared = false;
        if (Object.hasOwn(properties, key)) {
          declared = true;
          const id = `${pointer}/properties/${escapePointer(key)}`;
          used.add(id);
          walk(child, properties[key], id);
        }
        for (const [regex, pattern, sub] of patterns) {
          if (!regex.test(key)) continue;
          declared = true;
          const id = `${pointer}/patternProperties/${escapePointer(pattern)}`;
          used.add(id);
          walk(child, sub, id);
        }
        if (!declared && node.additionalProperties && typeof node.additionalProperties === 'object') {
          const id = `${pointer}/additionalProperties`;
          used.add(id);
          walk(child, node.additionalProperties, id);
        }
      }
    }
    if (Array.isArray(value)) {
      const prefix = node.prefixItems ?? [];
      value.forEach((item, index) => {
        if (index < prefix.length) walk(item, prefix[index], `${pointer}/prefixItems/${index}`);
        else if (node.items && typeof node.items === 'object') walk(item, node.items, `${pointer}/items`);
      });
    }
  };
  for (const document of documents) walk(document, schema, '#');
  return used;
}

/** locations: Map from collectLocations; used: Set from walkDocuments; allowlist: [{location, reason}] keyed by label. */
export function evaluate(locations, used, allowlist = []) {
  const byLabel = new Map([...locations.keys()].map((id) => [label(id), id]));
  const allowed = new Map();
  const problems = [];
  for (const entry of allowlist) {
    if (!entry || typeof entry.location !== 'string' || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      problems.push(`allowlist entry ${JSON.stringify(entry)} needs a location and a one-line reason`);
      continue;
    }
    if (allowed.has(entry.location)) problems.push(`allowlist lists ${entry.location} twice`);
    allowed.set(entry.location, entry.reason);
    const id = byLabel.get(entry.location);
    if (!id) problems.push(`allowlist names ${entry.location}, which the schema does not have (remove the entry)`);
    else if (used.has(id)) problems.push(`allowlist names ${entry.location}, which a deck now covers (remove the entry)`);
  }
  const totals = {};
  const missing = [];
  for (const [id, { kind }] of locations) {
    totals[kind] ??= { covered: 0, allowed: 0, total: 0 };
    const total = totals[kind];
    total.total += 1;
    if (used.has(id)) total.covered += 1;
    else if (allowed.has(label(id))) total.allowed += 1;
    else missing.push({ id, kind, label: label(id) });
  }
  return { totals, missing, problems };
}

export function corpusDecks(manifestPath = path.join(root, 'scripts/native-acceptance/qualification/manifest.json')) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const decks = [];
  const skipped = [];
  for (const deck of manifest.decks) (deck.source.endsWith('.json') ? decks : skipped).push(deck.source);
  return { decks, skipped };
}

export const LAYOUT_LOCATION = '#/$defs/Slide/properties/layout';

/**
 * The default catalog's layouts are vocabulary too: Slide.layout is a free catalog reference in the schema, so each default
 * layout id becomes a location of kind "layout", covered when a slide names it.
 */
export function addLayouts(locations, used, layoutIds, documents) {
  for (const id of layoutIds) locations.set(`${LAYOUT_LOCATION}=${JSON.stringify(id)}`, { kind: 'layout' });
  for (const document of documents) for (const slide of document.slides ?? []) if (typeof slide?.layout === 'string') used.add(`${LAYOUT_LOCATION}=${JSON.stringify(slide.layout)}`);
}

export function defaultLayoutIds(directory = path.join(root, 'packages/gallery/catalog/layouts')) {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
}

export function run({ files, allowlistPath = path.join(root, 'scripts/format-coverage-allowlist.json'), useAllowlist = true } = {}) {
  const schema = JSON.parse(readFileSync(path.join(root, 'spec/schemas/opf.schema.json'), 'utf8'));
  const { decks, skipped } = files ? { decks: files, skipped: [] } : corpusDecks();
  const documents = decks.map((file) => JSON.parse(readFileSync(path.resolve(root, file), 'utf8')));
  const locations = collectLocations(schema);
  const used = walkDocuments(schema, documents);
  addLayouts(locations, used, defaultLayoutIds(), documents);
  const allowlist = useAllowlist ? JSON.parse(readFileSync(allowlistPath, 'utf8')).entries : [];
  return { decks, skipped, ...evaluate(locations, used, allowlist) };
}

function format(result) {
  const lines = [];
  const kinds = ['key', 'value', 'branch', 'layout'];
  const names = { key: 'keys', value: 'enum and const values', branch: 'oneOf/anyOf branches', layout: 'default catalog layouts' };
  lines.push(`Format coverage of ${result.decks.length} decks${result.skipped.length ? ` (${result.skipped.length} non-JSON decks not walked: ${result.skipped.join(', ')})` : ''}:`);
  for (const kind of kinds) {
    const total = result.totals[kind] ?? { covered: 0, allowed: 0, total: 0 };
    lines.push(`  ${names[kind]}: ${total.covered} / ${total.total} covered, ${total.allowed} allowlisted`);
  }
  if (result.missing.length) {
    lines.push('', `Not covered by any deck and not in scripts/format-coverage-allowlist.json (${result.missing.length}):`);
    for (const kind of kinds) for (const item of result.missing.filter((entry) => entry.kind === kind)) lines.push(`  ${kind.padEnd(6)} ${item.label}`);
    lines.push('', 'Add a slide that uses each one to a coverage deck (scripts/native-acceptance/qualification/decks/coverage-*.opf.json),');
    lines.push('or, when it cannot or should not appear in a deck, an allowlist entry with a one-line reason.');
  }
  if (result.problems.length) lines.push('', 'Allowlist problems:', ...result.problems.map((problem) => `  ${problem}`));
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const filesAt = args.indexOf('--files');
  const files = filesAt >= 0 ? args[filesAt + 1].split(',').filter(Boolean) : undefined;
  const result = run({ files, useAllowlist: !args.includes('--no-allowlist') });
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(`${format(result)}\n`);
  if (!files && (result.missing.length || result.problems.length)) process.exitCode = 1;
}
