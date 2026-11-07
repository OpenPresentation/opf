// node chartex-compare.mjs [--write]: export the nine chartex fallback fixture decks with SH-17's branch and with main, compare them part
// by part (slide layouts and their tags matched by the layout's name), and with --write record the branch's hashes in the fixture,
// keeping main's as sh17Previous*.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const branch = 'C:/opf-work/sh-17-linear-smartart', main = 'C:/opf-work/sh-17-main2';
const { unzipSync, strFromU8 } = createRequire(`${branch}/packages/pptx/package.json`)('fflate');
const fixtureFile = `${branch}/packages/pptx/test/fixtures/chartex-fallback-main.json`, fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
const exporter = async tree => (await import(`file:///${tree}/packages/pptx/test/helpers/default-catalog.mjs`)).toPptx;
const [ours, theirs] = [await exporter(branch), await exporter(main)];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const run = async (toPptx, deck) => { const diagnostics = []; const bytes = await toPptx(structuredClone(deck), { chartex: 'fallback', onDiagnostic: d => diagnostics.push(`${d.code}${d.adaptation ? `/${d.adaptation}` : ''}`) }); return { bytes: new Uint8Array(bytes), diagnostics }; };
// Name every part by what it is, not its number: a layout by its name, its rels and tag by the same, a slide's rels with layout targets named.
function named(bytes) {
  const parts = unzipSync(bytes), text = path => strFromU8(parts[path]), out = new Map(), layoutName = new Map(), tagOf = new Map();
  for (const path of Object.keys(parts).filter(p => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(p))) layoutName.set(path.split('/').pop(), /<p:cSld name="([^"]*)"/.exec(text(path))?.[1] ?? path);
  for (const path of Object.keys(parts).filter(p => /^ppt\/slideLayouts\/_rels\/slideLayout\d+\.xml\.rels$/.test(p))) {
    const tag = /Target="\.\.\/tags\/(opfLayout\d+\.xml)"/.exec(text(path))?.[1]; if (tag) tagOf.set(tag, layoutName.get(path.split('/').pop().replace('.rels', '')));
  }
  const rename = value => value.replace(/slideLayout\d+\.xml/g, m => `layout[${layoutName.get(m)}]`).replace(/opfLayout\d+\.xml/g, m => `layoutTag[${tagOf.get(m)}]`);
  for (const [path, data] of Object.entries(parts)) {
    const key = rename(path), isText = /\.(xml|rels)$/.test(path);
    let value = isText ? rename(strFromU8(data)) : digest(data);
    if (isText) value = value.replace(/ r:id="rId\d+"/g, ' r:id=""').replace(/ id="\d{10}"/g, ' id=""').replace(/ Id="rId\d+"/g, ' Id=""');
    out.set(key, value);
  }
  return out;
}
const report = {};
for (const [name, deck] of Object.entries(fixture.decks)) {
  const [a, b] = [await run(ours, deck), await run(theirs, deck)], A = named(a.bytes), B = named(b.bytes);
  const added = [...A.keys()].filter(k => !B.has(k)), removed = [...B.keys()].filter(k => !A.has(k)), changed = [...A.keys()].filter(k => B.has(k) && A.get(k) !== B.get(k));
  const parts = unzipSync(a.bytes);
  report[name] = { added, removed, changed, diagnosticsEqual: JSON.stringify(a.diagnostics) === JSON.stringify(b.diagnostics), mainMatchesFixture: digest(b.bytes) === fixture.entries[name].sha256 };
  console.log(name, JSON.stringify(report[name]));
  if (process.argv.includes('--write')) {
    const entry = fixture.entries[name];
    entry.sh17PreviousSha256 = entry.sha256; entry.sh17PreviousBytes = entry.bytes;
    entry.sha256 = digest(a.bytes); entry.bytes = a.bytes.byteLength;
    entry.layoutParts = Object.keys(parts).filter(p => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(p)).length;
    entry.layoutTagParts = Object.keys(parts).filter(p => /^ppt\/tags\/opfLayout\d+\.xml$/.test(p)).length;
  }
}
if (process.argv.includes('--write')) {
  // Keep the fixture's key order: the previous hashes after the others, each entry's own order otherwise.
  writeFileSync(fixtureFile, `${JSON.stringify(fixture, null, 2)}\n`);
}
writeFileSync('C:/opf-work/shapes/sh-17/chartex-compare.json', JSON.stringify(report, null, 2));
