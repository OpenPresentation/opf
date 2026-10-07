import assert from 'node:assert/strict';
import {renderSvg, resolvePresentation, OPFRenderError, renderSlideSvg} from '../dist/index.js';

// RR-32: a template plus values previews exactly like the hand-written deck, because the renderer
// resolves variables with core resolveVariables before it composes anything.

const template = () => ({
  template: true,
  name: 'Quarterly review for {{client}}',
  variables: {
    client: { type: 'text', example: 'Acme Corp' },
    revenue: { type: 'number', format: '$#,##0', example: 1250000 },
    kickoff: { type: 'date', example: '2026-10-01' },
    wins: { type: 'list', example: ['Faster onboarding', 'Lower churn'] },
    logo: { type: 'image', example: 'asset:placeholder' },
    risk: '#B42318'
  },
  assets: {
    placeholder: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>',
    globex: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="blue"/></svg>'
  },
  slides: [
    { id: 'cover', title: 'Quarterly review: {{client}}', subtitle: 'Kickoff {{kickoff}}' },
    { id: 'wins', title: 'Wins', bullets: ['Revenue {{revenue}}', 'var:wins', [{ text: 'At risk', color: 'var:risk' }]] },
    { id: 'logo', title: 'Logo', image: 'var:logo' },
    { id: 'chart', title: 'Revenue', chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['This quarter', 'var:revenue']] } } }
  ]
});

const values = {
  client: 'Globex',
  revenue: '1234567',
  kickoff: '2026-10-01',
  wins: ['Shipped v2', 'Won renewal'],
  logo: 'asset:globex'
};

const handWritten = () => ({
  name: 'Quarterly review for Globex',
  variables: { risk: '#B42318' },
  assets: template().assets,
  slides: [
    { id: 'cover', title: 'Quarterly review: Globex', subtitle: 'Kickoff October 1, 2026' },
    { id: 'wins', title: 'Wins', bullets: ['Revenue $1,234,567', 'Shipped v2', 'Won renewal', [{ text: 'At risk', color: 'var:risk' }]] },
    { id: 'logo', title: 'Logo', image: 'asset:globex' },
    { id: 'chart', title: 'Revenue', chart: { type: 'column', data: { columns: ['Quarter', 'Revenue'], rows: [['This quarter', 1234567]] } } }
  ]
});

const options = { variables: values };
const expected = renderSvg(handWritten());
const actual = renderSvg(template(), options);
assert.equal(actual.length, 4);
actual.forEach((svg, index) => assert.equal(svg, expected[index], `slide ${index + 1} differs from the hand-written deck`));
assert.equal(renderSlideSvg(template(), 1, { ...options }), expected[1]);
assert.match(actual[0], /Quarterly review: Globex/);
assert.match(actual[1], /Revenue \$1,234,567/);
assert.match(actual[1], /Won renewal/);

// The resolved deck is what the editor traces: a concrete deck with no template marker or content declarations.
const resolved = resolvePresentation(template(), options);
assert.equal('template' in resolved.presentation, false);
assert.deepEqual(Object.keys(resolved.presentation.variables), ['risk']);
assert.equal(resolved.presentation.slides[0].title, 'Quarterly review: Globex');

// A template previews with each unfilled variable's example, and says so.
const diagnostics = [];
const preview = renderSvg(template(), { onDiagnostic: (entry) => diagnostics.push(entry) });
assert.match(preview[0], /Quarterly review: Acme Corp/);
assert.match(preview[1], /Faster onboarding/);
assert.deepEqual(diagnostics.filter((entry) => entry.code === 'variable-example-used').map((entry) => entry.id).sort(), ['client', 'kickoff', 'logo', 'revenue', 'wins']);

// Provided values win over examples; the rest stay example-filled.
assert.match(renderSlideSvg(template(), 0, { variables: { client: 'Initech' } }), /Quarterly review: Initech/);

// Nothing is invented: an unfilled variable with no example shows its token.
const bare = { template: true, variables: { who: { type: 'text' } }, slides: [{ id: 's', title: 'Hello {{who}}' }] };
assert.match(renderSlideSvg(bare, 0), /Hello \{\{who\}\}/);

// variables: false is the template editing view: the document as authored, tokens visible, nothing resolved.
const authored = renderSvg(template(), { variables: false });
assert.ok(authored[0].includes('Quarterly review: {{client}}'));
assert.equal(resolvePresentation(template(), { variables: false }).presentation.template, true);

// A normal deck with an unfilled required variable is refused, with a precise code and path.
const deck = template();
delete deck.template;
assert.throws(() => renderSlideSvg(deck, 0), (error) => error instanceof OPFRenderError && error.code === 'unfilled-variables' && error.path === '/variables/client');
assert.equal(renderSvg(deck, options).length, 4);

// Bad values and a bad option are reported, not rendered.
assert.throws(() => renderSlideSvg(template(), 0, { variables: { revenue: 'lots' }, onDiagnostic() {} }), (error) => error.code === 'invalid-variables');
assert.throws(() => renderSlideSvg(template(), 0, { variables: [] }), (error) => error.code === 'invalid-variables');

// Decks without content variables are not touched: same output with or without the option, and literal braces stay.
const plain = { variables: { risk: '#B42318' }, slides: [{ id: 's', title: 'Use {{braces}} freely', text: [{ text: 'Risk', color: 'var:risk' }] }] };
assert.equal(renderSlideSvg(plain, 0), renderSlideSvg(JSON.parse(JSON.stringify(plain)), 0, { variables: {} }));
assert.match(renderSlideSvg(plain, 0), /Use \{\{braces\}\} freely/);
assert.equal(resolvePresentation(plain).presentation, plain);
// A color value fills a color variable.
assert.notEqual(renderSlideSvg(plain, 0), renderSlideSvg(plain, 0, { variables: { risk: '#00AA00' } }));

console.log('Template variables: template plus values matches the hand-written deck on 4 slides; examples, unfilled and invalid inputs behave.');
