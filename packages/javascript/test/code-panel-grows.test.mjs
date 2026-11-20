// A short snippet whose panel takes the whole body (LH-101: code that needs at least LONE_TARGET of the body) sat at its role size in a
// half-empty panel. It now grows by the type scale's steps up to its display size while every line stays whole and the panel holds it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const source = 'type OrderPlaced = {\n  id: string;\n  key: string; // idempotency key\n  items: Item[];\n  placedAt: string;\n};\n\nawait queue.send(event, {\n  dedupeKey: event.key,\n});';
const code = (slide) => {
  const document = { $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', design: { theme: 'minimal', colorScheme: 'steel-blue', fontScheme: 'roboto' }, slides: [slide] };
  const context = resolveSlideContext(document, 0, { catalogs: [gallery] });
  const composed = composeSlide(context.slide, context.options);
  return composed.items.find((item) => item.field === 'code');
};
const body = (item) => item.codeLayout.parts.find((part) => part.role === 'body');

test('short code on a full-body panel grows while its lines stay whole', () => {
  for (const slide of [
    { title: 'Short code', code: { language: 'typescript', filename: 'order-placed.ts', source } },
    { title: 'Every event carries its own idempotency key', subtitle: 'Retries never double-charge, and workers can replay safely', code: { language: 'typescript', filename: 'order-placed.ts', source } },
  ]) {
    const item = code(slide), part = body(item);
    assert.ok(part.fit.fontSize > 23, `grown past its 22 px role size: ${part.fit.fontSize}`);
    assert.ok(part.fit.fontSize <= 32 + 1e-6, 'at most the display size');
    assert.equal(part.fit.lines.length, source.split('\n').length, 'every source line on one line');
    assert.ok(part.box.y >= item.box.y && part.box.y + part.box.height <= item.box.y + item.box.height + 0.01, 'inside its panel');
    assert.equal(item.codeLayout.diagnostics.length, 0);
  }
});

test('long code that fills the panel keeps its size', () => {
  const long = Array.from({ length: 16 }, (_, index) => `const value${index} = compute(${index}); // a line of the listing`).join('\n');
  const part = body(code({ title: 'Long code', code: { language: 'typescript', source: long } }));
  assert.ok(part.fit.fontSize <= 22 + 1e-6, `stays at or under its role size: ${part.fit.fontSize}`);
});
