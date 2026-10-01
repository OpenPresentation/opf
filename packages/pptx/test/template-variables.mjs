import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { toPptx, OPFPptxError } from '../dist/index.js';

// RR-32: a template plus values exports exactly the bytes of the hand-written equivalent deck, because
// toPptx resolves variables with core resolveVariables before it exports anything.

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=';
const OTHER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const template = () => ({
  template: true,
  name: 'Quarterly review for {{client}}',
  variables: {
    client: { type: 'text', example: 'Acme Corp' },
    revenue: { type: 'number', format: '$#,##0', example: 1250000 },
    kickoff: { type: 'date', example: '2026-10-01' },
    wins: { type: 'list', example: ['Faster onboarding', 'Lower churn'] },
    logo: { type: 'image', example: PIXEL },
    risk: '#B42318'
  },
  slides: [
    { id: 'cover', title: 'Quarterly review: {{client}}', subtitle: 'Kickoff {{kickoff}}', notes: 'Prepared for {{client}}' },
    { id: 'wins', title: 'Wins', bullets: ['Revenue {{revenue}}', 'var:wins', [{ text: 'At risk', color: 'var:risk' }]] },
    { id: 'logo', title: 'Logo', image: 'var:logo' },
    { id: 'chart', title: 'Revenue', chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['This quarter', 'var:revenue']] } } }
  ]
});

const values = { client: 'Globex', revenue: '1234567', kickoff: '2026-10-01', wins: ['Shipped v2', 'Won renewal'], logo: OTHER };

const handWritten = () => ({
  name: 'Quarterly review for Globex',
  variables: { risk: '#B42318' },
  slides: [
    { id: 'cover', title: 'Quarterly review: Globex', subtitle: 'Kickoff October 1, 2026', notes: 'Prepared for Globex' },
    { id: 'wins', title: 'Wins', bullets: ['Revenue $1,234,567', 'Shipped v2', 'Won renewal', [{ text: 'At risk', color: 'var:risk' }]] },
    { id: 'logo', title: 'Logo', image: OTHER },
    { id: 'chart', title: 'Revenue', chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['This quarter', 1234567]] } } }
  ]
});

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slideXml = (bytes, index) => strFromU8(unzipSync(bytes)[`ppt/slides/slide${index}.xml`]);

for (const provenance of ['full', false]) {
  const expected = await toPptx(handWritten(), { provenance });
  const actual = await toPptx(template(), { provenance, variables: values });
  assert.equal(digest(actual), digest(expected), `template export differs from the hand-written deck (provenance ${String(provenance)})`);
}
const filled = await toPptx(template(), { variables: values });
assert.match(slideXml(filled, 1), /Quarterly review: Globex/);
assert.match(slideXml(filled, 2), /Revenue \$1,234,567/);
assert.match(slideXml(filled, 2), /Won renewal/);

// A template exports with each unfilled variable's example, and says so.
const diagnostics = [];
const sample = await toPptx(template(), { onDiagnostic: (entry) => diagnostics.push(entry) });
assert.match(slideXml(sample, 1), /Quarterly review: Acme Corp/);
assert.match(slideXml(sample, 2), /Faster onboarding/);
assert.deepEqual(diagnostics.filter((entry) => entry.code === 'variable-example-used').map((entry) => entry.id).sort(), ['client', 'kickoff', 'logo', 'revenue', 'wins']);
// The same bytes as the example-filled hand-written deck: examples are the only fallback.
const exampleDeck = handWritten();
exampleDeck.name = 'Quarterly review for Acme Corp';
exampleDeck.slides[0] = { id: 'cover', title: 'Quarterly review: Acme Corp', subtitle: 'Kickoff October 1, 2026', notes: 'Prepared for Acme Corp' };
exampleDeck.slides[1].bullets = ['Revenue $1,250,000', 'Faster onboarding', 'Lower churn', [{ text: 'At risk', color: 'var:risk' }]];
exampleDeck.slides[2].image = PIXEL;
exampleDeck.slides[3].chart.data.rows = [['This quarter', 1250000]];
assert.equal(digest(sample), digest(await toPptx(exampleDeck)));

// A normal deck with an unfilled required variable is refused; a bad value is reported.
const deck = template();
delete deck.template;
await assert.rejects(toPptx(deck), (error) => error instanceof OPFPptxError && error.code === 'unfilled-variables' && error.path === '/variables/client');
assert.equal(digest(await toPptx(deck, { variables: values })), digest(filled));
await assert.rejects(toPptx(template(), { variables: { revenue: 'lots' } }), (error) => error.code === 'invalid-variables');
await assert.rejects(toPptx(template(), { variables: [] }), (error) => error.code === 'invalid-variables');

// Decks without content variables are untouched: literal braces stay, color variables behave as before.
const plain = { variables: { risk: '#B42318' }, slides: [{ id: 's', title: 'Use {{braces}} freely', text: [{ text: 'Risk', color: 'var:risk' }] }] };
assert.match(slideXml(await toPptx(plain), 1), /Use \{\{braces\}\} freely/);
assert.equal(digest(await toPptx(plain)), digest(await toPptx(plain, { variables: {} })));

console.log('Template variables: template plus values exports the same bytes as the hand-written deck; examples, unfilled and invalid inputs behave.');
