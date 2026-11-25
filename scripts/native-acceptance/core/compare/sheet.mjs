// NT-04a: the labeled finding sheet of one slide: OPF's preview and the application's picture side by side, a label bar over
// each ("OPF preview · 0.37.0 · default", "Keynote 16.0 · 0.37.0 · default"), red frames around the differing regions, a title
// line; JPEG. The layout is the 0.36.0 round's sheet.py finding sheet. Text is drawn as SVG that sharp rasterizes with whatever
// face the generic family resolves to on the machine (no font file is bundled for a review picture). A sheet is evidence: it
// is written only into a run directory, never into the repository.
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadPicture, sharp } from './picture.mjs';

const RED = '#e61414';
const OPF_BAR = '#141414';
const APP_BAR = '#0a3c78';
const FONT = "Helvetica, Arial, 'Liberation Sans', sans-serif";
const GAP = 12;

const escapeXml = (text) => String(text).replace(/[&<>"']/gu, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

// SVG text cannot be measured before it is drawn; an average advance of 0.56 em is close for sans-serif faces, and a line
// that may still run over is cut by the bar's clip.
const fits = (text, size, width) => text.length * size * 0.56 <= width;
function fit(text, size, width) {
  if (fits(text, size, width)) return text;
  let cut = text;
  while (cut && !fits(`${cut}…`, size, width)) cut = cut.slice(0, -1);
  return `${cut}…`;
}
function wrap(text, size, width, maxLines = 3) {
  const lines = [];
  let current = '';
  for (const word of String(text).split(/\s+/u).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (fits(next, size, width) || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = fit(`${lines[maxLines - 1]} …`, size, width);
  }
  return lines.map((line) => fit(line, size, width));
}

/** The label bar's sizes for a panel `width` px wide: a bold head line and up to three caption lines. */
function barLayout(caption, width) {
  const headSize = Math.max(13, Math.trunc(width / 42));
  const captionSize = Math.max(12, Math.trunc(headSize * 0.82));
  const pad = Math.max(4, Math.trunc(headSize / 3));
  const lines = caption ? wrap(caption, captionSize, width - 2 * pad) : [];
  const height = pad + headSize + lines.length * (captionSize + 3) + pad + (lines.length ? 2 : 0) + Math.trunc(headSize * 0.25);
  return { headSize, captionSize, pad, lines, height };
}

/**
 * One panel: the label bar on top of the slide picture (so the bar never covers the slide), red frames in slide fractions.
 * `barHeight` makes every bar of a row as tall as the tallest, so the slides line up.
 */
async function panel({ image, head, caption, frames = [], app = false, crop = null }, width, barHeight = 0) {
  const picture = image?.rgb ? image : await loadPicture(image);
  let pipeline = sharp()(Buffer.from(picture.rgb), { raw: { width: picture.width, height: picture.height, channels: 3 } });
  if (crop) {
    const [x0, y0, x1, y1] = crop;
    const left = Math.trunc(x0 * picture.width);
    const top = Math.trunc(y0 * picture.height);
    pipeline = sharp()(
      await pipeline
        .extract({ left, top, width: Math.trunc(x1 * picture.width) - left, height: Math.trunc(y1 * picture.height) - top })
        .png()
        .toBuffer(),
    );
  }
  const source = await pipeline.png().toBuffer({ resolveWithObject: true });
  const height = Math.round((width * source.info.height) / source.info.width);
  const slide = await sharp()(source.data).resize(width, height, { kernel: 'lanczos3', fit: 'fill' }).png().toBuffer();

  const { headSize, captionSize, pad, lines, height: own } = barLayout(caption, width);
  const bar = Math.max(own, barHeight);
  const line = Math.max(3, Math.trunc(width / 300));
  const rects = frames.map((frame) => {
    let [x0, y0, x1, y1] = frame;
    if (crop) {
      const [cx0, cy0, cx1, cy1] = crop;
      [x0, x1] = [(x0 - cx0) / (cx1 - cx0), (x1 - cx0) / (cx1 - cx0)];
      [y0, y1] = [(y0 - cy0) / (cy1 - cy0), (y1 - cy0) / (cy1 - cy0)];
    }
    const x = x0 * width - line / 2;
    const y = bar + y0 * height - line / 2;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${((x1 - x0) * width + line).toFixed(1)}" height="${((y1 - y0) * height + line).toFixed(1)}" fill="none" stroke="${RED}" stroke-width="${line}"/>`;
  });
  const captionLines = lines.map((text, i) => `<text x="${pad}" y="${pad + headSize + 2 + i * (captionSize + 3) + captionSize}" font-size="${captionSize}" fill="#ffeb96">${escapeXml(text)}</text>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${bar + height}" font-family="${escapeXml(FONT)}">
<defs><clipPath id="bar"><rect width="${width - pad}" height="${bar}"/></clipPath></defs>
<rect width="${width}" height="${bar}" fill="${app ? APP_BAR : OPF_BAR}"/>
<g clip-path="url(#bar)"><text x="${pad}" y="${pad + headSize - 2}" font-size="${headSize}" font-weight="bold" fill="#ffffff">${escapeXml(fit(head, headSize, width - 2 * pad))}</text>
${captionLines.join('\n')}</g>
${rects.join('\n')}
</svg>`;
  const data = await sharp()({ create: { width, height: bar + height, channels: 3, background: '#ffffff' } })
    .composite([
      { input: slide, top: bar, left: 0 },
      { input: Buffer.from(svg), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
  return { data, width, height: bar + height };
}

/**
 * Writes a finding sheet as JPEG.
 *   writeSheet({ out, title?, panels: [{ image, head, caption?, frames?: [[x0, y0, x1, y1]], app? }], cols?, width = 2400, crop? })
 * `image` is a path, a Buffer or a loaded picture; panels go side by side (all in one row up to 3, else 2 per row).
 */
export async function writeSheet({ out, title, panels, cols, width = 2400, crop = null }) {
  if (!panels?.length) throw new Error('writeSheet: no panels');
  const columns = cols ?? (panels.length <= 3 ? panels.length : 2);
  const rows = Math.ceil(panels.length / columns);
  const panelWidth = Math.trunc((width - GAP * (columns + 1)) / columns);
  const barHeight = Math.max(...panels.map((spec) => barLayout(spec.caption, panelWidth).height));
  const drawn = [];
  for (const spec of panels) drawn.push(await panel({ ...spec, crop }, panelWidth, barHeight));
  const panelHeight = Math.max(...drawn.map((item) => item.height));
  const titleSize = Math.max(20, Math.trunc(width / 70));
  const titleHeight = title ? titleSize + 2 * GAP : 0;
  const height = titleHeight + rows * (panelHeight + GAP) + GAP;
  const layers = [];
  const outlines = [];
  drawn.forEach((item, i) => {
    const x = GAP + (i % columns) * (panelWidth + GAP);
    const y = titleHeight + GAP + Math.trunc(i / columns) * (panelHeight + GAP);
    layers.push({ input: item.data, left: x, top: y });
    outlines.push(`<rect x="${x - 0.5}" y="${y - 0.5}" width="${item.width + 1}" height="${item.height + 1}" fill="none" stroke="#a0a0a0"/>`);
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="${escapeXml(FONT)}">
${title ? `<text x="${GAP}" y="${GAP + titleSize - 2}" font-size="${titleSize}" font-weight="bold" fill="#000000">${escapeXml(fit(title, titleSize, width - 2 * GAP))}</text>` : ''}
${outlines.join('\n')}
</svg>`;
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });
  mkdirSync(path.dirname(out), { recursive: true });
  await sharp()({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite(layers)
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(out);
  return out;
}

const inside = (parent, child) => {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};

/**
 * The sheet of one compared slide of a run directory, from its result.json: OPF's preview and the application's picture,
 * the regions framed on both, written to <run>/sheets/<fileId>/slide-<NNN>.jpg (or `out`, which must be inside the run).
 *   slideSheet(runDir, fileId, index, { caption?, out?, title? }) -> the path written
 */
export async function slideSheet(runDir, fileId, index, { caption, out, title } = {}) {
  const fileDir = path.join(runDir, 'files', fileId);
  const result = JSON.parse(readFileSync(path.join(fileDir, 'result.json'), 'utf8'));
  const slide = result.slides.find((candidate) => candidate.index === index);
  if (!slide) throw new Error(`slideSheet: ${fileId} has no slide ${index}`);
  if (!slide.compare?.preview || !slide.picture) throw new Error(`slideSheet: ${fileId} slide ${index} has no compared pair (${slide.compare?.note ?? 'not compared yet'})`);
  const target = out ?? path.join(runDir, 'sheets', fileId, `slide-${String(index).padStart(3, '0')}.jpg`);
  if (!inside(runDir, target)) throw new Error(`slideSheet: a sheet is written only inside the run directory (${target})`);
  const { version } = result.opf;
  const { variant, deck } = result.file;
  const frames = (slide.compare.regions ?? []).map((region) => region.box);
  const score = slide.compare.score === null ? '' : ` · score ${slide.compare.score.toFixed(3)}`;
  return writeSheet({
    out: target,
    title: title ?? `${deck} · ${variant} · slide ${index}${score}`,
    panels: [
      { image: path.join(runDir, slide.compare.preview), head: `OPF preview · ${version} · ${variant}`, frames },
      { image: path.join(fileDir, slide.picture), head: `${result.application.name} ${result.application.version} · ${version} · ${variant}`, caption, frames, app: true },
    ],
  });
}
