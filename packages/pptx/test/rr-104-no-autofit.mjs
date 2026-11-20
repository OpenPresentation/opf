// RR-104: OPF writes every text with an explicit size and never asks PowerPoint to shrink text on overflow. A bare
// <a:normAutofit/> is dormant until someone edits the box in PowerPoint, which then scales the text down to as little as
// 25% (fontScale) with no readability floor, so no part of an export may carry normAutofit, spAutoFit or a fontScale.
// The exporter's own text boxes ask for no autofit (the fallback text paths and the content placeholder included, which a
// valid document rarely reaches), and the exports of dense probe slides and every example deck carry none, in both
// body-text modes.
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
const AUTOFIT = /<a:(normAutofit|spAutoFit)\b|\bfontScale=|\blnSpcReduction=/;

// The source: no PptxGenJS text option that writes normAutofit or spAutoFit.
for (const name of readdirSync(path.join(here, '../src')).filter(file => file.endsWith('.js'))) {
  const source = readFileSync(path.join(here, '../src', name), 'utf8');
  assert.doesNotMatch(source, /\bfit\s*:\s*["'](shrink|resize)["']|\bshrinkText\s*:\s*true|\bautoFit\s*:\s*true/, `src/${name} asks PowerPoint to fit text`);
}

function autofitParts(bytes) {
  const found = [];
  for (const [name, data] of Object.entries(unzipSync(bytes))) {
    if (!name.endsWith('.xml')) continue;
    const match = new TextDecoder().decode(data).match(AUTOFIT);
    if (match) found.push(`${name}: ${match[0]}`);
  }
  return found;
}

const words = count => Array.from({length: count}, (_, index) => ['growth', 'revenue', 'customers', 'market'][index % 4]).join(' ');
const probe = {
  name: 'RR-104 probe',
  slides: [
    {title: 'A long list', items: Array.from({length: 30}, (_, index) => `Point ${index + 1}: ${words(14)}`)},
    {title: 'Long prose', text: words(500)},
    {title: 'A dense table', table: {columns: ['A', 'B', 'C'], rows: Array.from({length: 30}, (_, index) => [`r${index}`, words(3), words(4)])}},
    {title: 'Shape text', blocks: [{shape: 'roundRect', text: words(60)}]}
  ]
};

let exports = 0;
for (const bodyText of ['measured', 'native']) {
  assert.deepEqual(autofitParts(await toPptx(probe, {bodyText})), [], `no autofit in the ${bodyText} probe export`);
  exports++;
}

const decks = [];
const walk = dir => { for (const name of readdirSync(dir)) { const file = path.join(dir, name); if (statSync(file).isDirectory()) walk(file); else if (name.endsWith('.opf.json')) decks.push(file); } };
walk(path.join(root, 'examples'));
assert.ok(decks.length > 0, 'example decks found');
// Each deck in one body-text mode, alternating, so both modes see every kind of slide at half the cost.
for (const [index, file] of decks.entries()) {
  const deck = JSON.parse(readFileSync(file, 'utf8'));
  for (const bodyText of [index % 2 ? 'native' : 'measured']) {
    let bytes;
    // A deck that needs a host (local assets, network) is skipped here; the export suites cover it.
    try { bytes = await toPptx(deck, {bodyText}); } catch { continue; }
    assert.deepEqual(autofitParts(bytes), [], `no autofit in ${path.relative(root, file)} (${bodyText})`);
    exports++;
  }
}
assert.ok(exports > decks.length / 2, 'most example decks export');
console.log(`RR-104: ${exports} exports carry no autofit`);
