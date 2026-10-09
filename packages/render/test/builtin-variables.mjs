import assert from 'node:assert/strict';
import { resolvePresentation, OPFRenderError, renderSlideSvg } from '../dist/index.js';

// FA-04: built-in variables ({{speaker.name}}, var:organization.logo, ...) resolve before composition, so the
// preview draws the document's own metadata. FA-31: a footer zone writes them in its `text`, one line each.

const logo = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>';
const deck = () => ({
  name: 'Q4 Review',
  speaker: [{id: 'ada', name: 'Ada Lovelace', title: 'CTO'}, {id: 'grace', name: 'Grace Hopper'}],
  organization: {id: 'acme', name: 'Acme Corp', tagline: 'Build the future', logo},
  design: {footer: {left: {text: '{{organization.name}}\n{{speaker.name}}, {{speaker.title}}'}, right: {text: '{{organization.tagline}}'}}},
  slides: [{id: 'cover', title: '{{deck.name}}', subtitle: '{{speaker.name}}, {{speaker.title}} · {{organization.name}}', image: 'var:organization.logo'}]
});
const text = (svg, value) => svg.includes(`>${value}<`);

const source = deck();
const snapshot = structuredClone(source);
const svg = renderSlideSvg(source, 0, {trace: true});
assert.deepEqual(source, snapshot);
assert.ok(text(svg, 'Q4 Review'), 'deck.name');
assert.ok(svg.includes('Ada Lovelace, CTO · Acme Corp'), 'inline built-ins in a subtitle');
assert.ok(svg.includes('Build the future'), 'footer text built-in');
assert.ok(svg.includes('data:image/svg+xml'), 'var:organization.logo resolves to the image');
assert.ok(svg.includes('data-opf-furniture-field="text"'));
assert.ok(text(svg, 'Ada Lovelace, CTO'), 'the footer text draws the speaker name and title on its own line');
assert.ok(svg.indexOf('>Acme Corp<') < svg.indexOf('>Ada Lovelace, CTO<'), 'the organization line comes before the speaker line, as the text orders them');

const geometry = resolvePresentation(source).slides[0].geometry;
assert.deepEqual(geometry.diagnostics, []);
const parts = geometry.furniture.parts.filter(part => part.zone === 'left');
assert.deepEqual(parts.map(part => part.field), ['text']);
assert.equal(parts[0].text, 'Acme Corp\nAda Lovelace, CTO');

// A missing source: nothing is drawn for it, and onDiagnostic reports it instead of inventing text.
const bare = deck();
delete bare.speaker;
const seen = [];
const bareSvg = renderSlideSvg(bare, 0, {onDiagnostic: entry => seen.push(entry.code)});
assert.ok(!bareSvg.includes('{{speaker'));
assert.ok(seen.includes('variable-builtin-missing'));
assert.equal(resolvePresentation(bare).slides[0].geometry.furniture.parts.find(part => part.zone === 'left').text, 'Acme Corp\n, ');

// An unknown path is refused like any other variable error.
const typo = deck();
typo.slides[0].title = '{{speaker.nickname}}';
assert.throws(() => renderSlideSvg(typo, 0), error => error instanceof OPFRenderError && error.code === 'invalid-variables' && /nickname/.test(error.message));

// A template preview keeps an absent built-in visible and shows present metadata.
const template = deck();
template.template = true;
template.slides[0].title = '{{speaker.name}} / {{organization.legalName}}';
assert.ok(renderSlideSvg(template, 0).includes('Ada Lovelace / {{organization.legalName}}'));
console.log('Built-in variables passed: inline and whole-field forms, speaker footer text, missing and unknown sources, template preview.');
