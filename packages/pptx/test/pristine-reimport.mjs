import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';

// RR-94: an unedited OPF export re-imports without a reflow diagnostic per tagged group, and an image authored from a relative
// path or URL gets that source back instead of a base64 data: URI. An edited group (text, geometry) still reports.
const enc = new TextEncoder(), dec = new TextDecoder();
const options = {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'};
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8Dwn4GBgYEJRGAQAAAFHwEBjUa2uAAAAABJRU5ErkJggg==', 'base64')); // a 2x2 PNG
const reflow = issues => issues.filter(issue => /-import-reflow$/.test(issue.code));
const exportDeck = async (deck, extra = {}) => unzipSync(await toPptx(deck, {...options, ...extra}));
const read = async entries => {
  const issues = [], imported = await fromPptx(zipSync(entries), {onDiagnostic: issue => issues.push(issue)});
  return {imported, issues};
};
const slidePath = index => `ppt/slides/slide${index}.xml`;
const edit = (entries, index, mutate) => ({...entries, [slidePath(index)]: enc.encode(mutate(dec.decode(entries[slidePath(index)])))});
const imageOf = (slide) => slide.left?.image ?? slide.image ?? slide.blocks?.[0]?.image;

const deck = {
  design: {footer: {left: {text: 'Acme Corp'}, right: {text: '{{slide.number}} / {{deck.slideCount}}'}}},
  slides: [
    {title: 'A long title that wraps over several lines because it carries a great many words for the box to hold'},
    {title: 'Body text', text: 'A paragraph of plain text that is long enough to wrap onto a second visual line in its box on the slide.'},
    {title: 'Operating metric', type: 'metric', metric: {value: '42%', label: 'Review cycle reduction', description: 'Median reduction across customer review workflows.', delta: '+11 pts', trend: 'up'}},
    {title: 'Customer proof', type: 'quote', quote: {text: 'The new workflow made exceptions visible before they became escalations.', attribution: 'VP Operations, Acme Corp', source: 'Customer interview'}},
    {title: 'Rollout plan', type: 'timeline', timeline: {name: 'Regional rollout', events: [{when: 'Q1', what: 'Pilot'}, {when: 'Q2', what: 'Rollout'}]}},
    {title: 'Code', code: {language: 'js', source: 'const a = 1;\nconst b = 2;'}},
  ],
};

// The pristine export is quiet.
const entries = await exportDeck(deck);
{
  const {issues, imported} = await read(entries);
  assert.deepEqual(reflow(issues), [], 'No import-reflow diagnostic for an unedited export.');
  assert.deepEqual(issues, [], 'Nothing at all is reported for an unedited export.');
  assert.equal(imported.slides.length, 6);
  assert.equal(imported.slides[1].text, deck.slides[1].text);
}

// An edited group still reports: text edit (heading, plain text), moved shape.
{
  const heading = await read(edit(entries, 1, xml => xml.replace(/(<a:t>)A long title/, '$1An edited title')));
  assert.deepEqual(reflow(heading.issues).map(issue => [issue.code, issue.path]), [['heading-import-reflow', 'slides.0']], 'An edited heading reports, once.');
  const text = await read(edit(entries, 2, xml => xml.replace(/(<a:t>)A paragraph of plain text/, '$1A rewritten paragraph of plain text')));
  assert.ok(reflow(text.issues).some(issue => issue.code === 'text-import-reflow' && issue.path === 'slides.1'), 'Edited plain text reports.');
  const moved = await read(edit(entries, 2, xml => xml.replace(/(name="OPF text[^"]*"[\s\S]*?<a:off x=")(\d+)/, (_, head, x) => `${head}${Number(x) + 9525}`)));
  assert.ok(reflow(moved.issues).some(issue => issue.code === 'text-import-reflow'), 'A moved line reports.');
  const footer = await read(edit(entries, 2, xml => xml.replace(/(name="OPF furniture[^"]*"[\s\S]*?<a:t>)Acme Corp/, '$1Edited Corp')));
  assert.deepEqual(reflow(footer.issues).map(issue => issue.code), ['furniture-import-reflow'], 'An edited footer reports for its slide only.');
  assert.deepEqual(reflow((await read(edit(entries, 3, xml => xml.replace('42%', '43%')))).issues).map(issue => issue.code), ['metric-import-reflow']);
}

// A tag written by an earlier version (no signature) cannot be proven unchanged, so it keeps reporting.
{
  const unsigned = {...entries};
  for (const path of Object.keys(entries).filter(path => /^ppt\/tags\/opfHeading\d+\.xml$/.test(path))) {
    const xml = dec.decode(entries[path]);
    unsigned[path] = enc.encode(xml.replace(/val="([0-9A-F]+)"/, (_, hex) => {
      const data = JSON.parse(dec.decode(Uint8Array.from(hex.match(/../g), byte => parseInt(byte, 16))));
      delete data.sig;
      return `val="${[...enc.encode(JSON.stringify(data))].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}"`;
    }));
  }
  const {issues} = await read(unsigned);
  assert.ok(reflow(issues).some(issue => issue.code === 'heading-import-reflow'), 'A legacy heading tag still reports.');
  assert.ok(!reflow(issues).some(issue => issue.code !== 'heading-import-reflow'), 'Only the unsigned groups report.');
}

// Images: the authored relative path or URL comes back while the picture bytes still match.
const imageDeck = image => ({slides: [{title: 'Picture', left: {image}, 'center+right': {text: 'Beside the picture.'}}]});
const withAssets = {imageResolver: src => (src.endsWith('.png') ? {data: png, mediaType: 'image/png'} : undefined)};
for (const src of ['./pics/chart.png', 'pics/my chart.png', 'https://example.com/pics/chart.png']) {
  const imageEntries = await exportDeck(imageDeck(src), withAssets);
  const {issues, imported} = await read(imageEntries);
  assert.deepEqual(issues, [], `${src}: a pristine picture re-imports quietly.`);
  assert.equal(imageOf(imported.slides[0]).src, src, `${src}: the authored source is restored.`);
  // Replacing the picture bytes (a different image dropped in PowerPoint) keeps the data: URI.
  const media = Object.keys(imageEntries).find(path => /^ppt\/media\/.*\.png$/.test(path));
  const replaced = {...imageEntries, [media]: Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64'))};
  assert.match(imageOf((await read(replaced)).imported.slides[0]).src, /^data:image\/png;base64,/, `${src}: changed bytes keep the data: URI.`);
}
// Never recorded: a data: URI, an asset reference's data, an absolute path, a parent-relative path, a file: URL.
for (const src of ['/Users/someone/private/chart.png', '../secret/chart.png', 'pics/../../chart.png', 'file:///tmp/chart.png', 'C:\\pics\\chart.png']) {
  const imageEntries = await exportDeck(imageDeck(src), withAssets);
  const tagText = Object.keys(imageEntries).filter(path => /^ppt\/tags\/opfImage\d+\.xml$/.test(path)).map(path => dec.decode(imageEntries[path])).join('');
  const hex = (tagText.match(/val="([0-9A-F]+)"/) ?? [])[1];
  if (hex) assert.equal(JSON.parse(dec.decode(Uint8Array.from(hex.match(/../g), byte => parseInt(byte, 16))))?.src, undefined, `${src}: not recorded.`);
  const imageSrc = imageOf((await read(imageEntries).catch(() => ({imported: {slides: [{}]}}))).imported.slides[0])?.src;
  assert.ok(imageSrc === undefined || imageSrc.startsWith('data:'), `${src}: imports as embedded bytes, never as the path.`);
}
// A forged tag naming an unsafe source is ignored even when its media key matches.
{
  const imageEntries = await exportDeck(imageDeck('./pics/chart.png'), withAssets);
  const path = Object.keys(imageEntries).find(path => /^ppt\/tags\/opfImage\d+\.xml$/.test(path));
  const forged = {...imageEntries, [path]: enc.encode(dec.decode(imageEntries[path]).replace(/val="([0-9A-F]+)"/, (_, hex) => {
    const data = JSON.parse(dec.decode(Uint8Array.from(hex.match(/../g), byte => parseInt(byte, 16))));
    data.src = '../../../etc/passwd';
    return `val="${[...enc.encode(JSON.stringify(data))].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}"`;
  }))};
  assert.match(imageOf((await read(forged)).imported.slides[0]).src, /^data:image\/png/, 'An unsafe recorded source is never restored.');
}
console.log('Pristine re-import passed: 6 tagged-group kinds and the footer import quietly, edits and legacy tags still report, and image sources round-trip safely.');
