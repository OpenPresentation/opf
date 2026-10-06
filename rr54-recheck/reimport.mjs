// C4 offline step: re-import PowerPoint's saved copies and compare them with the re-import of the unsaved deck.
//   node reimport.mjs <c4-after checkout (b076bb6)> <c4-before checkout (f0ea480)> [--simulate]
// Both opf-pptx checkouts need core opf#376 linked and a built dist/. Each copy is re-imported with the build that
// exported it (the evidence hash is written on export and checked on import). Reads out/saved/<file> (written by
// save-copy.ps1) for every C4 file of manifest.json; writes out/reimport.json and out/reimport.md.
//   --simulate  instead re-spells the source decks the way PowerPoint 16.0.20430 did in opf#385 ($ -> \$, ' "x"' -> '\ "x"')
//               and re-imports those: an offline self-test of this script, not native evidence.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
const simulate = args.includes('--simulate');
const [afterDir, beforeDir] = args.filter(arg => arg !== '--simulate').map(arg => path.resolve(arg));
const dir = afterDir;
const importers = {'c4-after': await import(pathToFileURL(path.join(afterDir, 'dist/index.js')).href), 'c4-before': await import(pathToFileURL(path.join(beforeDir, 'dist/index.js')).href)};
const {unzipSync, zipSync, strFromU8, strToU8} = await import(pathToFileURL(path.join(dir, 'node_modules/fflate/esm/index.mjs')).href);
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const respell = code => code.replace(/(^|[^\\])\$/g, '$1\\$').replace(/ (?=&quot;|")/g, '\\ ');
function powerPointSpelling(bytes) {
  const parts = unzipSync(bytes);
  for (const name of Object.keys(parts).filter(part => /^ppt\/charts\/chart(?:Ex)?\d+\.xml$/.test(part))) {
    parts[name] = strToU8(strFromU8(parts[name])
      .replace(/<c:formatCode>([^<]*)<\/c:formatCode>/g, (_m, code) => `<c:formatCode>${respell(code)}</c:formatCode>`)
      .replace(/(<(?:c|cx):numFmt formatCode=")([^"]*)"/g, (_m, open, code) => `${open}${respell(code)}"`)
      .replace(/(<cx:lvl\b[^>]*?\bformatCode=")([^"]*)"/g, (_m, open, code) => `${open}${respell(code)}"`));
  }
  return zipSync(parts);
}
const codes = bytes => {
  const parts = unzipSync(bytes);
  return Object.keys(parts).filter(part => /^ppt\/charts\/chart(?:Ex)?\d+\.xml$/.test(part)).sort().map(part => [part, [...new Set([...strFromU8(parts[part]).matchAll(/formatCode(?:>|=")([^<"]*)/g)].map(match => match[1]))]]);
};

const results = [];
for (const [id, deck] of Object.entries(manifest.decks).filter(([, deck]) => deck.check === 'C4')) {
  for (const [file, record] of Object.entries(deck.files)) {
    const source = path.join('decks', file), saved = path.join('out', 'saved', file);
    const result = {deck: id, file, build: record.build, mode: simulate ? 'simulated' : 'native-save'};
    if (!simulate && !existsSync(saved)) { results.push({...result, status: 'NOT RUN', note: `missing ${saved}`}); continue; }
    const sourceBytes = new Uint8Array(readFileSync(source));
    result.sourceSha256Ok = sha(sourceBytes) === record.sha256;
    const bytes = simulate ? powerPointSpelling(sourceBytes) : new Uint8Array(readFileSync(saved));
    const diagnostics = [];
    const imported = await importers[record.build].fromPptx(bytes, {onDiagnostic: item => diagnostics.push(item)});
    const payloads = imported.slides.map(slide => slide.chart ?? slide.table ?? null);
    result.payloadsEqual = sha(JSON.stringify(payloads)) === record.reimport.payloadsSha256;
    result.datasetsEqual = JSON.stringify(imported.datasets ?? null) === JSON.stringify(record.reimport.datasets);
    result.dataDiagnostics = diagnostics.filter(item => /data-provenance|dataset-unavailable/.test(item.code)).map(item => `${item.code} ${item.path ?? ''}`.trim());
    result.scatterPointNames = payloads.find(item => item?.type === 'scatter')?.data?.rows?.map(row => row[0]);
    // Codes the saved chart parts carry that the source did not (PowerPoint's re-spellings), for the record.
    const before = new Map(codes(sourceBytes)), after = codes(bytes);
    result.respelledCodes = after.flatMap(([part, list]) => list.filter(code => !(before.get(part) ?? []).includes(code)).map(code => `${part}: ${code}`));
    const pass = result.payloadsEqual && result.datasetsEqual && result.dataDiagnostics.length === 0;
    result.status = pass ? 'PASS' : record.build.endsWith('before') ? 'BASELINE (expected fail)' : 'FAIL';
    results.push(result);
  }
}
mkdirSync('out', {recursive: true});
const prefix = simulate ? 'reimport-simulated' : 'reimport';
writeFileSync(`out/${prefix}.json`, JSON.stringify({results}, null, 2) + '\n');
const md = [`# C4 re-import of saved copies (${simulate ? 'SIMULATED re-spelling, not native evidence' : 'PowerPoint SaveCopyAs'})`, '', '| Deck | Build | Status | Payloads equal | Datasets equal | Data diagnostics | Scatter point names | Re-spelled codes |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...results.map(r => `| ${r.file} | ${r.build} | ${r.status} | ${r.payloadsEqual ?? ''} | ${r.datasetsEqual ?? ''} | ${(r.dataDiagnostics ?? []).join('<br>')} | ${(r.scatterPointNames ?? []).join(', ')} | ${(r.respelledCodes ?? []).map(code => '`' + code.replaceAll('|', '\\|') + '`').join('<br>')} |`)];
writeFileSync(`out/${prefix}.md`, md.join('\n') + '\n');
console.log(md.join('\n'));
