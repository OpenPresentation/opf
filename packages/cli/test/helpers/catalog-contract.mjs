import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Resolve the public API beside the executable under test, including a global
// installed CLI. A copied harness must not read a checkout's catalog snapshot.
export async function installedLayoutAuthority(executable) {
  const require = createRequire(realpathSync(executable));
  const { gallery, catalogIndexes } = await import(pathToFileURL(require.resolve('@openpresentation/gallery')).href);
  const ids = catalogIndexes.layouts.records.map(record => record.id);
  assert.ok(ids.length > 0, 'the installed layout catalog is nonempty');
  assert.equal(new Set(ids).size, ids.length, 'the installed layout index has unique ids');
  assert.deepEqual(Object.keys(gallery.layouts), ids, 'installed layout records and index agree in order');
  return { ids, records: gallery.layouts, source: gallery.source };
}

export function assertLayoutCatalog(records, summary, authority) {
  const ids = records.map(record => record.id);
  assert.equal(new Set(ids).size, ids.length, 'CLI layout ids are unique');
  assert.deepEqual(ids, authority.ids, 'CLI returns every installed layout in catalog order');
  assert.equal(summary.count, authority.ids.length, 'CLI layout count matches the installed authority');
  assert.equal(summary.source, authority.source, 'CLI catalog source matches the installed authority');
  for (const record of records) assert.deepEqual(record, { id: record.id, ...authority.records[record.id] }, record.id + ': CLI layout record matches the installed authority');
  return ids;
}
