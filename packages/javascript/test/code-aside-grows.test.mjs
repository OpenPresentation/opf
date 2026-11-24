// C07: a short snippet and its explanation beside it grow together as a body (LH-48), as a snippet alone grows: the code toward its
// 32 px display size and the aside by the same steps where it has room, instead of a thin strip of small code across a white body.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const record = { id: 'code', name: 'Code', direction: 'column', regions: [{ name: 'title' }, { direction: 'row', regions: [{ name: 'body', size: 3, accepts: ['code'], flow: 'column' }, { name: 'aside', size: 2, accepts: ['text', 'list'], role: 'supporting', flow: 'column', anchor: 'middle' }] }] };
const code = { code: { language: 'javascript', source: 'const total = sum(items);\nconsole.log(total);' } };
const body = (result) => result.items.find((item) => item.field === 'code').codeLayout.parts.find((part) => part.role === 'body').fit.fontSize;

for (const aside of [{ text: 'The reducer adds each value to a running sum.' }, { bullets: ['Starts at zero', 'Empty list gives zero'] }]) {
  test(`C07: a snippet beside a ${Object.keys(aside)[0]} grows with it`, () => {
    const grown = composeSlide({ title: 'Keep it easy to inspect', blocks: [code, aside] }, { width: 1280, height: 720, layout: record });
    const plain = composeSlide({ title: 'Keep it easy to inspect', blocks: [code, aside] }, { width: 1280, height: 720, layout: record, fill: false });
    assert.ok(body(grown) > body(plain), `the code grows (${body(plain)} to ${body(grown)})`);
    const text = (result) => result.items.find((item) => item.path === 'slides.0.blocks.1.' + Object.keys(aside)[0]).text.fontSize;
    assert.ok(text(grown) >= text(plain), `the aside never shrinks (${text(plain)} to ${text(grown)})`);
    assert.deepEqual(grown.diagnostics.filter((entry) => entry.code === 'text-overflow'), []);
  });
}
