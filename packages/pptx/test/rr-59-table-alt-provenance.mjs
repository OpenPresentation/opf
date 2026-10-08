// RR-59 with FA-27: a table restored from its authored provenance record takes its alt from the native frame, so the
// alt the frame shows wins and an alt removed in PowerPoint stays removed, while the authored cells still restore.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

const table = {alt: 'Quarterly revenue by region', columns: ['Region', 'Revenue'], rows: [['North', 12], ['South', 7.5]]};
const bytes = await toPptx({slides: [{table}]});
const tableOf = deck => deck.slides[0].table ?? deck.slides[0].blocks?.find(block => block.table)?.table;

assert.deepEqual(tableOf(await fromPptx(bytes)), table, 'unchanged: authored cells (numbers stay numbers) and the alt return');

const edit = replace => {
  const entries = unzipSync(bytes);
  entries['ppt/slides/slide1.xml'] = strToU8(replace(strFromU8(entries['ppt/slides/slide1.xml'])));
  return zipSync(entries);
};
const removed = tableOf(await fromPptx(edit(xml => xml.replace(/(<p:cNvPr[^>]*name="OPF table 1")[^>]*?descr="[^"]*"/, '$1'))));
assert.equal(removed.alt, undefined, 'an alt removed in PowerPoint is not restored from the provenance record');
assert.deepEqual(removed.rows, table.rows, 'the authored cells still restore');
const changed = tableOf(await fromPptx(edit(xml => xml.replace('descr="Quarterly revenue by region"', 'descr="Revenue by region"'))));
assert.equal(changed.alt, 'Revenue by region', 'an alt edited in PowerPoint wins over the recorded one');
console.log('RR-59 table alt provenance: unchanged, removed and edited frame alt text with authored cells passed.');
