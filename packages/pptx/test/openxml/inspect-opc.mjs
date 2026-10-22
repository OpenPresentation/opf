import assert from 'node:assert/strict';
import {readFile, writeFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';

if (process.argv.length !== 4) throw new Error('Usage: node test/openxml/inspect-opc.mjs INPUT_DIRECTORY REPORT_JSON');
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: ''});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const results = [];
for (const file of (await readdir(process.argv[2])).filter(name => name.endsWith('.pptx')).sort()) {
  const bytes = await readFile(path.join(process.argv[2], file)), entries = unzipSync(bytes), errors = [];
  const readXml = name => parser.parse(new TextDecoder().decode(entries[name]));
  for (const part of Object.keys(entries).filter(name => name.endsWith('.rels')).sort()) {
    const ids = new Set();
    const base = part === '_rels/.rels' ? '' : path.posix.dirname(path.posix.dirname(part));
    for (const rel of array(readXml(part).Relationships?.Relationship)) {
      if (ids.has(rel.Id)) errors.push({code: 'duplicate-relationship-id', part, id: rel.Id});
      ids.add(rel.Id);
      if (rel.TargetMode === 'External') continue;
      const target = decodeURIComponent(rel.Target.split('#')[0]);
      const resolvedTarget = path.posix.normalize(target.startsWith('/') ? target.slice(1) : path.posix.join(base, target));
      if (!Object.hasOwn(entries, resolvedTarget)) errors.push({code: 'missing-internal-target', part, id: rel.Id, target: rel.Target, resolvedTarget});
    }
  }
  for (const entry of array(readXml('[Content_Types].xml').Types?.Override)) {
    if (!Object.hasOwn(entries, decodeURIComponent(entry.PartName.slice(1)))) errors.push({code: 'missing-content-type-part', part: entry.PartName});
  }
  results.push({file, sha256: createHash('sha256').update(bytes).digest('hex'), errors});
}
assert.ok(results.length, 'No PPTX files found.');
await writeFile(process.argv[3], JSON.stringify({scope: 'Internal relationship target existence, unique relationship IDs and content-type override target existence. This is not full OPC or native Office conformance.', results}, null, 2) + '\n');
console.log(`Inspected ${results.length} PPTX files; ${results.reduce((n, result) => n + result.errors.length, 0)} relationship/content-type errors.`);
process.exitCode = results.some(result => result.errors.length) ? 1 : 0;
