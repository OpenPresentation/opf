#!/usr/bin/env node
// MR-62: core and the gallery release in lockstep at one version, so core no longer refuses at runtime to use a gallery whose
// catalog record schema differs (the former `gallery-schema-mismatch`). This is the build-time guarantee that replaces it: the
// `CATALOG_SCHEMA` constant core reads (packages/javascript/src/catalog-schemas.ts) equals the one the gallery declares, in its
// `opf.catalogSchema` (package.json, which its build exports as `CATALOG_SCHEMA`) and in its typed declaration
// (packages/gallery/src/index.d.ts, `CATALOG_SCHEMA: <n>`). Reads sources only, so it needs no build.
//
// Usage: node scripts/check-catalog-schema.mjs [root]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE = 'packages/javascript/src/catalog-schemas.ts';
const GALLERY_MANIFEST = 'packages/gallery/package.json';
const GALLERY_TYPES = 'packages/gallery/src/index.d.ts';

/** The catalog schema generations declared by the two packages' sources, keyed by where each is declared. */
export function readCatalogSchemas(root) {
  const read = (file) => readFileSync(path.join(root, file), 'utf8');
  const number = (text, pattern, where) => {
    const match = pattern.exec(text);
    if (!match) throw new Error(`${where}: the CATALOG_SCHEMA declaration was not found`);
    return Number(match[1]);
  };
  return {
    [`${CORE} (CATALOG_SCHEMA)`]: number(read(CORE), /export const CATALOG_SCHEMA\s*=\s*(\d+)\s*;/, CORE),
    [`${GALLERY_MANIFEST} (opf.catalogSchema)`]: JSON.parse(read(GALLERY_MANIFEST)).opf?.catalogSchema,
    [`${GALLERY_TYPES} (CATALOG_SCHEMA)`]: number(read(GALLERY_TYPES), /export declare const CATALOG_SCHEMA\s*:\s*(\d+)\s*;/, GALLERY_TYPES),
  };
}

/** Findings for a set of declarations: each must be the same positive integer. Empty when they agree. */
export function catalogSchemaFindings(schemas) {
  const entries = Object.entries(schemas);
  const findings = entries.filter(([, value]) => !Number.isInteger(value) || value < 1).map(([where, value]) => `${where} is ${JSON.stringify(value)}, not a positive integer`);
  if (new Set(entries.map(([, value]) => value)).size > 1) {
    findings.push(`core and the gallery disagree on the catalog record schema:\n${entries.map(([where, value]) => `  ${where} = ${JSON.stringify(value)}`).join('\n')}\nRaise both together; they release in lockstep.`);
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const schemas = readCatalogSchemas(root);
  const findings = catalogSchemaFindings(schemas);
  if (findings.length > 0) {
    console.error(`check:catalog-schema failed\n${findings.join('\n')}`);
    process.exit(1);
  }
  console.log(`check:catalog-schema: core and the gallery both declare CATALOG_SCHEMA ${Object.values(schemas)[0]}`);
}
