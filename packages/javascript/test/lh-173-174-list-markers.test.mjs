// LH-173: a stepper or column label never splits a word ("Researc/h" in a six-step row): the label steps down to the size its widest
// word fits at, never under the list size, and the labels of the row share that size.
// LH-174: in a list where only some entries have an icon, an entry without one keeps its bullet in the chip column, centered there,
// instead of an empty slot; its hanging indent is shortened by the same amount so PowerPoint's native bullet sits where the preview draws it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, fitList, LIST_HEADING_SCALE } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const step = (text, description, start) => ({ region: 'steps', items: [{ text, description }], numbering: { style: 'arabic', start } });
const six = {
  title: 'Six steps from idea to launch',
  blocks: [['Idea', 'Capture the problem in one sentence.'], ['Research', 'Talk to ten customers.'], ['Design', 'Sketch and test the flow.'], ['Build', 'Ship the smallest useful version.'], ['Test', 'Fix what the pilot finds.'], ['Launch', 'Announce and measure.']].map(([text, description], index) => step(text, description, index + 1)),
};
const labels = (result) => result.items.filter((item) => item.region === 'steps').map((item) => item.text.listEntries[0]);

for (const direction of ['ltr', 'rtl']) {
  test(`LH-173 (${direction}): a six-step row keeps "Research" whole, its labels at one size above the descriptions`, () => {
    const result = composeSlide(six, { layout: layouts.process, direction });
    const entries = labels(result);
    assert.equal(entries.length, 6);
    for (const entry of entries) assert.equal(entry.text.lines.length, 1, `${entry.text.lines.join('/')} is on one line`);
    const sizes = new Set(entries.map((entry) => entry.text.fontSize));
    assert.equal(sizes.size, 1, `one label size, got ${[...sizes]}`);
    const [size] = sizes, list = result.items.find((item) => item.region === 'steps').text.fontSize;
    assert.ok(size < list * LIST_HEADING_SCALE - 1e-6, 'the labels stepped down');
    assert.ok(size >= list - 1e-6, 'never under the list size');
    for (const entry of entries) assert.ok(entry.description.fontSize <= size + 1e-6);
  });
}

test('LH-173: a label that fits keeps LIST_HEADING_SCALE times the list size', () => {
  const fit = fitList([{ text: 'Plan', description: 'Scope it.' }], { x: 0, y: 0, width: 400, height: 300 }, 32, 16, { style: { fontFamily: 'sans-serif', fontWeight: 400 }, heading: true });
  assert.ok(Math.abs(fit.listEntries[0].text.fontSize - fit.fontSize * LIST_HEADING_SCALE) < .05);
});

test('LH-173: a word too wide even at the list size keeps the full label size (it breaks either way)', () => {
  const fit = fitList([{ text: 'Supercalifragilisticexpialidocious', description: 'A long word.' }], { x: 0, y: 0, width: 120, height: 400 }, 32, 16, { style: { fontFamily: 'sans-serif', fontWeight: 400 }, heading: true });
  assert.ok(Math.abs(fit.listEntries[0].text.fontSize - fit.fontSize * LIST_HEADING_SCALE) < .05);
});

const iconed = [{ text: 'Check your account email', icon: 'lucide:mail' }, { text: 'Install the desktop app' }, { text: 'Invite two teammates', icon: 'lucide:users' }];
const iconedArabic = [{ text: 'تحقق من بريد الحساب', icon: 'lucide:mail' }, { text: 'ثبت تطبيق سطح المكتب' }, { text: 'ادع زميلين', icon: 'lucide:users' }];
const box = { x: 100, y: 100, width: 800, height: 400 };
const style = { fontFamily: 'sans-serif', fontWeight: 400 };

for (const direction of ['ltr', 'rtl']) {
  test(`LH-174 (${direction}): an entry without an icon keeps its bullet, centered in the chip column`, () => {
    const fit = fitList(direction === 'rtl' ? iconedArabic : iconed, box, 28, 16, { style, icons: true, ...(direction === 'rtl' ? { direction } : {}) });
    const [first, second, third] = fit.listEntries;
    assert.ok(first.icon && third.icon && !second.icon);
    assert.equal(first.marker.none, true);
    assert.equal(second.marker.none, undefined);
    assert.equal(second.marker.text, '•');
    // The bullet sits inside the chip column, its hanging indent shortened by the shift so the text starts where the others' does.
    const column = direction === 'rtl' ? box.x + box.width : box.x, shift = Math.abs(second.marker.x - column);
    assert.ok(shift > 0 && shift < first.icon.diameter / 2, `shift ${shift}`);
    assert.ok(Math.abs(second.marker.indent + shift - first.marker.indent) < 1e-6);
    assert.equal(second.textBox.x, first.textBox.x);
  });
}

test('LH-174: ruled rows with icons on some entries keep a bullet in the chip column too', () => {
  const rows = [{ text: 'Faster sync', icon: 'lucide:zap', description: 'Changes reach every device in under a second.' }, { text: 'Offline mode', description: 'Keep working without a connection.' }, { text: 'Shared folders', icon: 'lucide:folder', description: 'Invite a team to one folder.' }];
  const fit = fitList(rows, box, 24, 16, { style, icons: true, rows: true });
  assert.ok(fit.rules?.length);
  assert.equal(fit.listEntries[1].marker.text, '•');
  assert.equal(fit.listEntries[1].marker.none, undefined);
  assert.equal(fit.listEntries[0].marker.none, true);
});

test('LH-174: design.listBullet none keeps the empty slot, and a list with every icon draws no bullet', () => {
  const none = fitList(iconed, box, 28, 16, { style, icons: true, bullet: 'none' });
  assert.ok(none.listEntries.every((entry) => entry.marker.none === true));
  const all = fitList(iconed.map((entry) => ({ ...entry, icon: entry.icon ?? 'lucide:download' })), box, 28, 16, { style, icons: true });
  assert.ok(all.listEntries.every((entry) => entry.marker.none === true && entry.icon));
});
