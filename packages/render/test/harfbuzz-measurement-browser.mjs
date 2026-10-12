// The actual browser loader attaches HarfBuzz when shapeWasm is supplied and retains fontkit when omitted.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { loadCorpora } from '../scripts/script-corpora.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const evidence = JSON.parse(await readFile(new URL('../docs/evidence/harfbuzz-layout-measurement/report.json', import.meta.url), 'utf8'));
const corpora = await loadCorpora();
const targets = evidence.samples.filter(sample => Math.abs(sample.delta) > 0.001);
const faceData = [];
for (const [family, pkg] of [['Noto Sans Myanmar', 'noto-sans-myanmar'], ['Noto Sans Syriac', 'noto-sans-syriac']]) {
  const row = targets.find(sample => sample.family === family);
  const data = await readFile(path.join(path.dirname(require.resolve(`@expo-google-fonts/${pkg}/package.json`)), '400Regular', row.fontFile));
  assert.equal(createHash('sha256').update(data).digest('hex'), row.fontSha256);
  faceData.push({family, data: data.toString('base64')});
}
const wasm = await readFile(require.resolve('harfbuzzjs/dist/harfbuzz.wasm'));
const bundle = await build({stdin: {contents: "import {loadFonts} from './dist/fonts-browser.js';window.loadFonts=loadFonts;", resolveDir: root, sourcefile: 'entry.js'}, bundle: true, platform: 'browser', format: 'iife', write: false});
const browser = await chromium.launch({channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined});
const unexpected = [];
try {
  const page = await browser.newPage();
  await page.route('**/*', route => { unexpected.push(route.request().url()); return route.abort(); });
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({content: bundle.outputFiles[0].text});
  const rows = await page.evaluate(async ({faceData, wasm, targets, groups}) => {
    const bytes = encoded => Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    const faces = faceData.map(face => ({family: face.family, data: bytes(face.data)}));
    const shaped = await window.loadFonts({faces, shapeWasm: bytes(wasm)});
    const fallback = await window.loadFonts({faces});
    if (!shaped.outlines.shape || fallback.outlines.shape) throw new Error('The loader selected the wrong shaper');
    return targets.map(row => {
      const group = groups.find(group => group.samples.some(sample => sample.id === row.id));
      const sample = group.samples.find(sample => sample.id === row.id);
      const style = {fontFamily: row.family, lang: row.language, direction: row.direction};
      return {id: row.id, shaped: shaped.textMeasurement.measure(sample.text, 25, style), fallback: fallback.textMeasurement.measure(sample.text, 25, style)};
    });
  }, {faceData, wasm: wasm.toString('base64'), targets, groups: corpora.groups});
  for (const row of rows) {
    const expected = targets.find(sample => sample.id === row.id);
    assert.ok(Math.abs(row.shaped - expected.harfbuzz) < 1e-8, row.id);
    assert.ok(Math.abs(row.fallback - expected.fontkit) < 1e-8, `${row.id}: fallback`);
  }
  assert.deepEqual(unexpected, []);
  console.log(`Browser HarfBuzz measurement: ${JSON.stringify(rows)}; no network, supplied-WASM and no-WASM handles agree with reviewed Node references.`);
} finally { await browser.close(); }
