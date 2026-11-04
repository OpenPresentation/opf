// LH-20: the pictures-only PPTX (`toPptx(deck, {as: 'images'})`, `opf convert deck.opf.json deck.pptx --as images`). Each slide
// is one full-bleed PNG drawn by opf-render, so the file looks exactly like the preview in every viewer and needs no fonts. It
// keeps the slide's speaker notes, its hidden flag and its section, and the picture's alternative text (the `descr` screen
// readers announce) is the slide's text. It is a fidelity fallback, not an editable deck: nothing on a slide can be edited as
// text, and nothing can be imported back as OPF content.
//
// The picture deck is an ordinary OPF deck handed back to the exporter: each slide is an image background with `alt` (a
// meaningful background, which the export draws as a full-slide picture carrying that text), stretched to the canvas, with no
// layout, furniture or content of its own.

/** Pixels per reference pixel: 2 draws the 1280 x 720 reference slide at 2560 x 1440, about 192 dpi on a 13.33 in slide. */
export const PICTURE_SCALE = 2;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const runsText = value => typeof value === 'string' ? value : Array.isArray(value)
  ? value.map(run => typeof run === 'string' ? run : isObject(run) && typeof run.text === 'string' ? run.text : '').join('') : '';
const cellText = cell => Array.isArray(cell) ? runsText(cell) : isObject(cell) ? (Object.hasOwn(cell, 'value') ? (Array.isArray(cell.value) || typeof cell.value === 'string' ? runsText(cell.value) : String(cell.value ?? '')) : typeof cell.name === 'string' ? cell.name : '') : cell == null ? '' : String(cell);

// The payloads of a slide in reading order: its promoted regions (top row first, then left to right), its blocks (groups
// depth first) or the slide itself.
const REGIONS = ['top:left', 'top', 'top:right', 'left', 'center', 'right', 'bottom:left', 'bottom', 'bottom:right'];
function payloads(slide) {
  const out = [];
  const walk = block => {
    if (!isObject(block)) return;
    if (Array.isArray(block.blocks)) { for (const child of block.blocks) walk(child); return; }
    out.push(block);
  };
  const regions = Object.keys(slide).filter(key => /^(?:top|center|bottom|left|right)(?:[:+](?:top|center|bottom|left|right))*$/.test(key) && isObject(slide[key]))
    .sort((a, b) => (REGIONS.indexOf(a) + 1 || 99) - (REGIONS.indexOf(b) + 1 || 99));
  if (regions.length) for (const key of regions) walk(slide[key]);
  if (Array.isArray(slide.blocks)) for (const block of slide.blocks) walk(block);
  if (!regions.length && !Array.isArray(slide.blocks)) out.push(slide);
  return out;
}

function listText(entries, lines, depth = 0) {
  if (!Array.isArray(entries)) return;
  for (const entry of entries) {
    if (Array.isArray(entry) || typeof entry === 'string') { lines.push(runsText(entry)); continue; }
    if (!isObject(entry)) continue;
    lines.push([runsText(entry.text), runsText(entry.description)].filter(Boolean).join(': '));
    listText(entry.items ?? entry.bullets, lines, depth + 1);
  }
}

/**
 * The text of one slide, in reading order, one line per heading, paragraph, list entry, table row and so on: the alternative
 * text of the slide's picture. A chart, image or diagram contributes its own `alt`.
 */
export function slideText(slide) {
  if (!isObject(slide)) return '';
  const lines = [];
  for (const field of ['tag', 'title', 'subtitle']) lines.push(runsText(slide[field]));
  for (const payload of payloads(slide)) {
    lines.push(runsText(payload.text));
    listText(payload.items, lines);
    listText(payload.bullets, lines);
    const table = payload.table;
    if (isObject(table)) {
      if (Array.isArray(table.columns)) lines.push(table.columns.map(cellText).join(', '));
      if (Array.isArray(table.rows)) for (const row of table.rows) if (Array.isArray(row)) lines.push(row.map(cellText).join(', '));
    }
    const quote = payload.quote;
    if (typeof quote === 'string' || Array.isArray(quote)) lines.push(runsText(quote));
    else if (isObject(quote)) lines.push(runsText(quote.text), [quote.attribution, quote.role, quote.source].map(runsText).filter(Boolean).join(', '));
    const metric = payload.metric;
    if (typeof metric === 'string') lines.push(metric);
    else if (isObject(metric)) lines.push([metric.value, metric.unit, metric.label, metric.delta].map(runsText).filter(Boolean).join(' '));
    const timeline = payload.timeline, events = Array.isArray(timeline) ? timeline : isObject(timeline) && Array.isArray(timeline.events) ? timeline.events : [];
    if (isObject(timeline)) lines.push(runsText(timeline.name));
    for (const event of events) if (isObject(event)) lines.push([runsText(event.when), runsText(event.what)].filter(Boolean).join(': '));
    const code = payload.code;
    if (typeof code === 'string') lines.push(code);
    else if (isObject(code) && typeof code.text === 'string') lines.push(code.text);
    for (const field of ['chart', 'image', 'diagram']) {
      const value = payload[field];
      if (isObject(value) && typeof value.alt === 'string') lines.push(value.alt);
      else if (field === 'image' && typeof payload.alt === 'string') lines.push(payload.alt);
    }
    lines.push(runsText(isObject(payload.caption) ? payload.caption.text : payload.caption));
  }
  return lines.map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

const base64 = bytes => {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let text = '';
  for (let index = 0; index < bytes.length; index += 0x8000) text += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(text);
};

/**
 * The default slide rasterizer in Node: opf-render's `toPng` of the deck slide, with the export's fonts handle, catalogs and
 * date. It draws embedded images (data URIs and `assets`); a host that resolves local or remote images passes its own
 * `slideRasterizer` (core's `convert` does). Rejects with code `slide-rasterizer-unavailable` when opf-render is not installed.
 */
export async function defaultSlideRasterizer(presentation, slide, {scale, fonts, catalogs, date, onDiagnostic}) {
  let render;
  try {
    render = await import('@openpresentation/opf-render');
  } catch (error) {
    const unavailable = new Error('A pictures-only PPTX needs the optional peer @openpresentation/opf-render to draw the slides (or an options.slideRasterizer).', {cause: error});
    unavailable.code = 'slide-rasterizer-unavailable';
    throw unavailable;
  }
  return new Uint8Array(await render.toPng(presentation, slide, {scale, ...(fonts ? {fonts} : {}), ...(catalogs ? {catalogs} : {}), ...(date ? {date} : {}), ...(onDiagnostic ? {onDiagnostic} : {})}));
}

/**
 * The picture deck of `presentation` (variables already resolved): one stretched image background per slide whose `alt` is the
 * slide's text (else "Slide N", so the picture is never decorative), with the slide's notes, hidden flag and section.
 */
export async function pictureDeck(presentation, rasterize) {
  const slides = [];
  for (const [index, slide] of presentation.slides.entries()) {
    const png = await rasterize(index + 1);
    if (!(png instanceof Uint8Array) || png[0] !== 0x89 || png[1] !== 0x50) throw Object.assign(new Error(`The slide rasterizer returned no PNG for slide ${index + 1}.`), {code: 'slide-render-failed', path: `slides.${index}`});
    const picture = {
      ...(typeof slide.id === 'string' ? {id: slide.id} : {}),
      ...(slide.hidden === true ? {hidden: true} : {}),
      ...(typeof slide.section === 'string' ? {section: slide.section} : {}),
      ...(slide.notes !== undefined ? {notes: slide.notes} : {}),
      design: {background: {type: 'image', src: `data:image/png;base64,${base64(png)}`, fit: 'stretch', alt: slideText(slide) || `Slide ${index + 1}`}},
    };
    slides.push(picture);
  }
  return {
    name: presentation.name,
    ...(presentation.language !== undefined ? {language: presentation.language} : {}),
    ...(presentation.author !== undefined ? {author: presentation.author} : {}),
    // The canvas of the source deck, so every picture fills the same slide size.
    ...(isObject(presentation.design) && presentation.design.dimensions !== undefined ? {design: {dimensions: presentation.design.dimensions}} : {}),
    slides,
  };
}
