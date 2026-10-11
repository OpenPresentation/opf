// Lists the core example slides whose renderer SVG changes with the opf#361 policy: the golden path (toSvg with trace, default catalog,
// no fonts handle), run once plainly and once under node --import ./patched/register.mjs; writes measure/golden-svg-<label>.json.
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {examples} from '@openpresentation/opf/examples';
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {toSvg} from '@openpresentation/opf-render';
const label = process.argv[2];
const out = {};
for (const {file, deck} of examples) {
  let svgs; try { svgs = toSvg(deck, {trace: true, catalogs: [defaultCatalog]}); } catch (e) { out[file] = {error: e.message}; continue; }
  out[file] = svgs.map(s => createHash('sha256').update(s).digest('hex').slice(0, 16));
}
writeFileSync(`measure/golden-svg-${label}.json`, JSON.stringify(out));
console.log(label, Object.keys(out).length, 'decks');
