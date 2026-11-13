// composeSlide measures each string, size and style once per call through the host's textMeasurement (the LH-189 tight composition
// composes a slide twice): same output as an unremembered measurement, the host still sees every distinct request in the same order,
// and nothing is remembered across calls or from a call that threw.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const slides = [
  { title: 'Ship it', text: 'Every team owns its numbers.' },
  { title: 'Quarterly review', items: ['Revenue grew 12 percent', 'Churn fell to 2 percent', 'Hiring stays flat until the second half'] },
  { quote: { text: 'Simple things should be simple, complex things should be possible.', attribution: 'Alan Kay' } },
  { metric: { value: '42%', label: 'Share of new users from referrals' } },
];
// A host measurement that counts its calls; its widths are a pure function of the request.
function host() {
  const calls = [], counts = new Map();
  const measurement = {
    measure(text, size, style) {
      const key = JSON.stringify([text, size, style]);
      calls.push(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return [...text].length * size * (style.fontWeight >= 600 ? 0.56 : 0.5);
    },
  };
  return { measurement, calls, counts };
}
test('each distinct request reaches the host once per call, and the composition is the same on every call', () => {
  for (const slide of slides) {
    const first = host(), second = host();
    const a = composeSlide(slide, { textMeasurement: first.measurement }), b = composeSlide(slide, { textMeasurement: second.measurement });
    assert.ok(first.calls.length > 0, 'the slide is measured by the host');
    assert.ok([...first.counts.values()].every((count) => count === 1), 'each distinct request reaches the host once per call');
    assert.deepEqual(first.calls, second.calls, 'the host sees the same requests in the same order');
    assert.deepEqual(a, b);
  }
});

test('nothing is remembered across calls', () => {
  const { measurement, counts } = host();
  composeSlide(slides[0], { textMeasurement: measurement });
  const first = new Map(counts);
  composeSlide(slides[0], { textMeasurement: measurement });
  for (const [key, count] of first) assert.equal(counts.get(key), count * 2, 'a second call measures again');
});

test('a request that throws is asked again, never remembered', () => {
  let failures = 0;
  const measurement = {
    measure(text, size) {
      if (text.includes('Q') && failures < 1) { failures++; throw new RangeError('not yet'); }
      return [...text].length * size * 0.5;
    },
  };
  assert.throws(() => composeSlide({ title: 'Q review' }, { textMeasurement: measurement }), /not yet/);
  assert.doesNotThrow(() => composeSlide({ title: 'Q review' }, { textMeasurement: measurement }));
});

test('the host methods run on the host object (a class with private fields)', () => {
  class Host {
    #scale = 0.5;
    resolved = 0;
    measure(text, size) { return [...text].length * size * this.#scale; }
    resolveStyle(style) { this.resolved += this.#scale > 0 ? 1 : 0; return style; }
  }
  const host = new Host();
  assert.doesNotThrow(() => composeSlide(slides[0], { textMeasurement: host }));
  assert.ok(host.resolved > 0, 'resolveStyle reached the host');
});
