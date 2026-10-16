// Exercise the real browser observation callback without launching a browser: its character addresses are UTF-16 SVG addresses.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./script-corpora-slides-browser.mjs', import.meta.url), 'utf8');
const start = source.indexOf('const observed = await page.evaluate(');
const end = source.indexOf(', [cases.map(', start);
assert.ok(start >= 0 && end > start, 'the maintained observation callback must remain directly testable');
let current;
const host = {
  set innerHTML(value) { current = value; },
  querySelectorAll() {
    return [{
      textContent: current,
      getAttribute(name) { return {'font-size': '54', 'font-family': 'Test', textLength: '10'}[name] ?? null; },
      hasAttribute(name) { return name === 'textLength'; },
      querySelectorAll() { return []; },
      removeAttribute() {},
      getComputedTextLength() { return 10; },
      getStartPositionOfChar(index) {
        assert.ok(!/[\uDC00-\uDFFF]/u.test(current[index]), 'SVG addresses must not point inside a surrogate pair');
        return {x: -index};
      },
    }];
  },
};
const observe = vm.runInNewContext(`(${source.slice(start + 'const observed = await page.evaluate('.length, end)})`, {
  document: {querySelector: () => host, fonts: [{family: 'Test', status: 'loaded'}]},
  getComputedStyle: () => ({fontSize: '54px'}),
});
const samples = [
  {id: 'whitespace-isolates', svg: ' \t\u2067אבs\u{1F600}ג\u2069\r\n', expected: [{first: -3, last: -8}]},
  {id: 'literal-s', svg: '\ts\u{1F600}s\u00A0', expected: [{first: -1, last: -4}]},
  {id: 'ordinary', svg: 'אבג', expected: [{first: 0, last: -2}]},
  {id: 'empty', svg: '\t\r\n\u2067\u2069 ', expected: []},
];
const observed = observe([samples, ['54']]);
for (const [index, sample] of samples.entries()) {
  assert.deepEqual(JSON.parse(JSON.stringify(observed[index].orders)), sample.expected, sample.id);
  assert.equal(observed[index].runs.length, 1, 'the rest of the real observation callback still runs');
}
console.log('Script corpus order: actual observation callback ignores whitespace/isolates, retains literal s and uses UTF-16 addresses. No browser/native qualification.');
