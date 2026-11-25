// FR-03: a `slide:<id>` link is a fragment link in the SVG that carries the slide id (`data-opf-slide-link`), the slide it names carries its id
// (`data-opf-slide`) only when a link names it, the PDF writes a go-to-page link, a slide left out of the PDF leaves its link text unlinked,
// and the player follows a slide link and leaves every other link to the browser.
import assert from 'node:assert/strict';
import { toSvg, toPdf } from './catalog-harness.mjs'; // registers the gallery snapshot (the documents name gallery records)
import { loadFonts } from '../dist/fonts-node.js';
import { openPdf } from './pdf-helpers.mjs';
import { linkAt, slideIndexById } from '../src/deck-runtime.js';

const deck = (link = 'slide:pricing') => ({
  language: 'en-US', design: { fontScheme: 'roboto', colorScheme: 'corporate-blue' },
  slides: [
    { id: 'agenda', title: 'Agenda', blocks: [{ text: [{ text: 'Pricing', link }, ' or ', { text: 'the site', link: 'https://acme.com' }] }, { shape: 'roundRect', text: 'Jump', link }] },
    { id: 'pricing', title: 'Pricing', text: 'Plans' },
    { id: 'appendix', title: 'Appendix', hidden: true, text: [{ text: 'Back', link: 'slide:agenda' }] },
  ],
});

// The SVG: a slide link is a fragment link with the id, not a tab; a web link is as before.
const [agenda, pricing, appendix] = toSvg(deck());
assert.match(agenda, /<a data-opf-slide-link="pricing" href="#slide:pricing">/);
assert.equal((agenda.match(/data-opf-slide-link="pricing"/g) ?? []).length, 2, 'the run and the shape');
assert.match(agenda, /<a href="https:\/\/acme\.com" rel="noopener noreferrer" target="_blank">/);
assert.doesNotMatch(agenda.replace(/<a href="https:[^>]*>/g, ''), /target="_blank"/, 'a slide link opens no tab');
// Only the slides a link names carry their id.
assert.match(pricing, /^<svg[^>]* data-opf-slide="pricing"/);
assert.match(agenda, /^<svg[^>]* data-opf-slide="agenda"/, 'the appendix links back to the agenda');
assert.doesNotMatch(appendix, /data-opf-slide=/);
// A deck without slide links draws exactly as before: no new attribute anywhere.
const plain = toSvg({ ...deck(), slides: deck().slides.map(slide => JSON.parse(JSON.stringify(slide).replaceAll('slide:pricing', 'https://acme.com/pricing').replaceAll('slide:agenda', 'https://acme.com/agenda'))) });
assert.ok(plain.every(svg => !svg.includes('data-opf-slide')));
// An unknown slide is a validation error at the boundary.
assert.throws(() => toSvg(deck('slide:nowhere'), 1), error => error.code === 'invalid-opf');

// The PDF: a link annotation that goes to the page of the slide.
const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual' });
const diagnostics = [];
const pdf = await toPdf(deck(), '1-2', { fonts, onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
const text = Buffer.from(pdf).toString('latin1');
assert.match(text, /\/S\/GoTo\/D\[\d+ 0 R \/XYZ 0 [\d.]+ null\]/, 'a go-to-page link');
assert.equal((text.match(/\/S\/GoTo/g) ?? []).length, 2, 'the run and the text of the shape are linked in the PDF');
assert.equal((text.match(/\/S\/URI/g) ?? []).length, 1, 'the web link is still a URI link');
assert.ok(!diagnostics.some(diagnostic => diagnostic.code === 'pdf-link-skipped'));
const doc = await openPdf(pdf);
assert.equal(doc.numPages, 2);
// Page 1 is the agenda; its slide link points at page 2 (the pricing slide).
const pageRef = /\/Type\/Page\/Parent \d+ 0 R/g;
assert.equal((text.match(pageRef) ?? []).length, 2);

// A slide left out of the PDF has no page: the text stays and is not linked, and the PDF says so.
const leftOut = [];
const partial = await toPdf(deck(), 1, { fonts, onDiagnostic: diagnostic => leftOut.push(diagnostic) });
assert.equal((Buffer.from(partial).toString('latin1').match(/\/S\/GoTo/g) ?? []).length, 0);
assert.ok(leftOut.some(diagnostic => diagnostic.code === 'pdf-link-skipped' && /pricing/.test(diagnostic.message)), JSON.stringify(leftOut));

// A tagged PDF keeps its structure with the page links, and without them when the target slide is not in the file.
for (const selection of ['1-2', 1]) {
  const tagged = Buffer.from(await toPdf(deck(), selection, { fonts, tagged: true })).toString('latin1');
  assert.equal((tagged.match(/\/S\/GoTo/g) ?? []).length, selection === 1 ? 0 : 2);
}

// The player's helpers: the id a click sits in, and the slide an id names.
const anchor = { getAttribute: name => (name === 'data-opf-slide-link' ? 'pricing' : null) };
const web = { getAttribute: () => null };
assert.deepEqual(linkAt({ closest: () => anchor }), { link: anchor, slide: 'pricing' });
assert.deepEqual(linkAt({ closest: () => web }), { link: web });
assert.equal(linkAt({ closest: () => null }), undefined);
assert.equal(linkAt(null), undefined);
assert.equal(slideIndexById(deck(), 'pricing'), 1);
assert.equal(slideIndexById(deck(), 'nowhere'), -1);
console.log('slide links: ok');
