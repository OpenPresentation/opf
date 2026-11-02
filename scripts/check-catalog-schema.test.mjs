// MR-62: the root check that core's CATALOG_SCHEMA equals the gallery's, in place of the runtime gallery-schema-mismatch refusal.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { catalogSchemaFindings, readCatalogSchemas } from './check-catalog-schema.mjs';

const temp = mkdtempSync(path.join(tmpdir(), 'opf-catalog-schema-'));
after(() => rmSync(temp, { recursive: true, force: true }));

function fixture(name, { core = 4, manifest = 4, types = 4 } = {}) {
  const root = path.join(temp, name);
  for (const dir of ['packages/javascript/src', 'packages/gallery/src']) mkdirSync(path.join(root, dir), { recursive: true });
  writeFileSync(path.join(root, 'packages/javascript/src/catalog-schemas.ts'), `/** doc */\nexport const CATALOG_SCHEMA = ${core};\n`);
  writeFileSync(path.join(root, 'packages/gallery/package.json'), JSON.stringify({ name: '@openpresentation/gallery', opf: { catalogSchema: manifest } }));
  writeFileSync(path.join(root, 'packages/gallery/src/index.d.ts'), `export declare const CATALOG_SCHEMA: ${types};\n`);
  return root;
}

test('equal constants in core, the gallery manifest and the gallery types pass', () => {
  assert.deepEqual(catalogSchemaFindings(readCatalogSchemas(fixture('equal'))), []);
});

test('a core that reads another schema than the gallery declares is named with every declaration', () => {
  const findings = catalogSchemaFindings(readCatalogSchemas(fixture('core', { core: 5 })));
  assert.equal(findings.length, 1);
  assert.match(findings[0], /packages\/javascript\/src\/catalog-schemas\.ts \(CATALOG_SCHEMA\) = 5/);
  assert.match(findings[0], /packages\/gallery\/package\.json \(opf\.catalogSchema\) = 4/);
});

test('a gallery manifest that disagrees with its own typed export fails too', () => {
  assert.equal(catalogSchemaFindings(readCatalogSchemas(fixture('types', { types: 3 }))).length, 1);
  assert.equal(catalogSchemaFindings(readCatalogSchemas(fixture('manifest', { manifest: 3 }))).length, 1);
});

test('a missing or non-integer declaration is a finding, and an unreadable constant throws', () => {
  assert.match(catalogSchemaFindings({ a: undefined, b: 4 })[0], /not a positive integer/);
  assert.match(catalogSchemaFindings({ a: 0, b: 0 })[0], /not a positive integer/);
  const root = fixture('broken');
  writeFileSync(path.join(root, 'packages/javascript/src/catalog-schemas.ts'), 'export const CATALOG_SCHEMA = schemaVersion;\n');
  assert.throws(() => readCatalogSchemas(root), /declaration was not found/);
});

test('this checkout declares one catalog schema', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  assert.deepEqual(catalogSchemaFindings(readCatalogSchemas(root)), []);
});
