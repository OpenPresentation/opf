// FR-08: an embed is drawn as its static form: the preview picture whole on the surface color, or a card (badge, title, site name),
// linked to its address; the PDF links the frame; a preview that does not resolve draws the card and says so; nothing loads the page.
import assert from 'node:assert/strict';
import { toSvg, toPdf, toPng } from './catalog-harness.mjs'; // registers the gallery snapshot (the documents name gallery records)
import { loadFonts } from '../dist/fonts-node.js';

const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const deck = {
  language: 'en-US', design: { fontScheme: 'roboto', colorScheme: 'corporate-blue' },
  assets: { shot: `data:image/png;base64,${pixel}` },
  slides: [
    { id: 'live', title: 'Live', embed: { src: 'https://app.example.com/dashboards/revenue', title: 'Revenue dashboard', aspectRatio: 1.6, preview: 'asset:shot' } },
    { id: 'card', title: 'Card', embed: 'https://www.prototype.example.com/checkout?x=1' },
    { id: 'beside', title: 'Beside', blocks: [{ text: 'The checkout flow.' }, { embed: { src: 'https://prototype.example.com/checkout', title: 'Prototype' }, caption: 'Prototype, version 3' }] },
  ],
};
const [live, card, beside] = toSvg(deck, undefined, { trace: true });

// The preview form: the picture contained in the frame on the surface color, linked to the address in a new tab, the frame marked for a presenter.
assert.match(live, /<g [^>]*data-opf-embed="slides\.0\.embed"[^>]*data-opf-embed-src="https:\/\/app\.example\.com\/dashboards\/revenue"[^>]*data-opf-embed-title="Revenue dashboard"/);
assert.match(live, /<a aria-label="Revenue dashboard" href="https:\/\/app\.example\.com\/dashboards\/revenue" rel="noopener noreferrer" target="_blank">/);
assert.match(live, /<image [^>]*preserveAspectRatio="xMidYMid meet"/);
assert.match(live, /data-opf-link-area="true"/);
const frame = /data-opf-embed-width="([\d.]+)" data-opf-embed-x/.exec(live) ?? /data-opf-embed-height="([\d.]+)"/.exec(live);
assert.ok(frame, 'the frame is measured');
const dimension = name => Number(new RegExp(`data-opf-embed-${name}="([\\d.]+)"`).exec(live)[1]);
assert.ok(Math.abs(dimension('width') / dimension('height') - 1.6) < 0.01, 'the frame has the aspect ratio');
assert.doesNotMatch(live, /<text[^>]*>Revenue dashboard/, 'a preview has no card text');

// The card: the badge, the title (the site name when there is none) and the site name; never the address.
assert.match(card, /data-opf-embed-title="prototype\.example\.com"/);
assert.match(card, /<g data-opf-embed-text="title"><text [^>]*font-weight="700"[^>]*>prototype\.example\.com<\/text><\/g>/);
assert.equal((card.match(/prototype\.example\.com<\/text>/g) ?? []).length, 1, 'the site name is not drawn twice');
assert.doesNotMatch(card.replace(/ data-opf-embed-src="[^"]*"| href="[^"]*"/g, ''), /checkout|x=1/, 'the card never prints the address');
assert.match(card, /<circle /);
assert.match(card, /<path [^>]*d="M [\d. L]+ Z"/);
assert.match(beside, /<g data-opf-embed-text="title"><text [^>]*>Prototype<\/text><\/g>/);
assert.match(beside, /<g data-opf-embed-text="site"><text [^>]*>prototype\.example\.com<\/text><\/g>/);
assert.match(beside, />Prototype, version 3</, 'the caption is drawn');

// Without a trace and without embeds a deck draws exactly as before: no embed attribute anywhere.
const plain = toSvg({ slides: [{ title: 'Plain', text: 'Words' }] }, 1);
assert.doesNotMatch(plain, /data-opf-embed/);

// A preview nothing resolved draws the card, reports it, and fails under strictAssets.
const unresolved = [];
const remote = toSvg({ slides: [{ title: 'Remote', embed: { src: 'https://app.example.com/', title: 'App', preview: 'https://cdn.example.com/shot.png' } }] }, 1, { onDiagnostic: entry => unresolved.push(entry) });
assert.match(remote, /<g data-opf-embed-text="title">/);
assert.ok(unresolved.some(entry => entry.code === 'unresolved-asset' && entry.path === 'slides.0.embed.preview' && entry.placeholder === 'card'), JSON.stringify(unresolved));
assert.throws(() => toSvg({ slides: [{ title: 'Remote', embed: { src: 'https://app.example.com/', preview: 'https://cdn.example.com/shot.png' } }] }, 1, { strictAssets: true }), error => error.code === 'unresolved-asset');
const resolved = toSvg({ slides: [{ title: 'Remote', embed: { src: 'https://app.example.com/', preview: 'https://cdn.example.com/shot.png' } }] }, 1, { imageResolver: () => `data:image/png;base64,${pixel}` });
assert.match(resolved, /<image [^>]*preserveAspectRatio="xMidYMid meet"/, 'a host resolver supplies the picture');

// The frame is a link annotation in the PDF; nothing is fetched.
const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual' });
const pdf = Buffer.from(await toPdf(deck, '1-3', { fonts })).toString('latin1');
assert.equal((pdf.match(/\/S\/URI\/URI\(https:\/\/app\.example\.com\/dashboards\/revenue\)/g) ?? []).length, 1, 'the preview frame is linked');
assert.ok((pdf.match(/\/S\/URI\/URI\(https:\/\/www\.prototype\.example\.com\/checkout\?x=1\)/g) ?? []).length >= 1, 'the card frame is linked (and its title text)');
assert.ok((pdf.match(/\/S\/URI\/URI\(https:\/\/prototype\.example\.com\/checkout\)/g) ?? []).length >= 1, 'the block frame is linked');

// The PNG draws the static form.
const png = await toPng(deck, 2, { fonts });
assert.ok(png.byteLength > 2000);
console.log('embed: ok');
