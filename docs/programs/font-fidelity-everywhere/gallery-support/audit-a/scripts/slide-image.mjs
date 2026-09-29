// Native slide-image probe for audit A (FF-26). The geometry helpers mirror parity/scripts/parity.mjs
// (imageRect, visibleImage, placedImage, cropDelta, geomDelta, rasterSize, svgSize, imageSize) so the presence audit
// and the parity scoreboard measure a picture the same way, at the same 0.02 pt tolerance. Keep them in sync.
import { createHash } from 'node:crypto';
import path from 'node:path';

export const GEOM_TOL_PT = 0.02;
const PX_PT = 0.75;
const r3 = (n) => Math.round(n * 1000) / 1000;
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attrs = (s) => Object.fromEntries([...String(s).matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], unesc(m[2])]));

// ---------- preview image intrinsic size (as parity.mjs) ----------
function rasterSize(b) {
  const ok = (w, h) => (w > 0 && h > 0 ? { w, h } : null);
  if (b.length >= 24 && b.toString('latin1', 1, 4) === 'PNG') return ok(b.readUInt32BE(16), b.readUInt32BE(20));
  if (b.length >= 10 && /^GIF8[79]a$/.test(b.toString('latin1', 0, 6))) return ok(b.readUInt16LE(6), b.readUInt16LE(8));
  if (b.length >= 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const kind = b.toString('latin1', 12, 16);
    if (kind === 'VP8X') return ok(1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3));
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return ok(1 + (v & 0x3fff), 1 + ((v >>> 14) & 0x3fff)); }
    if (kind === 'VP8 ') return ok(b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff);
    return null;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let size = null, orientation = 1;
    for (let at = 2; at + 4 <= b.length;) {
      if (b[at] !== 0xff) return null; const marker = b[at + 1]; at += 2;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (marker === 0xda || marker === 0xd9) break;
      const len = b.readUInt16BE(at); if (len < 2 || at + len > b.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && len >= 7) size = ok(b.readUInt16BE(at + 5), b.readUInt16BE(at + 3));
      if (marker === 0xe1 && b.toString('latin1', at + 2, at + 8) === 'Exif\0\0') {
        const t = at + 8, le = b.toString('latin1', t, t + 2) === 'II', u16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o)), u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
        const ifd = t + u32(t + 4); for (let i = 0, n = u16(ifd); i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === 0x0112) orientation = u16(e + 8); }
      }
      at += len;
    }
    return size && orientation >= 5 && orientation <= 8 ? { w: size.h, h: size.w } : size;
  }
  return null;
}
function svgSize(text) {
  const root = text.match(/<svg\b[^>]*>/)?.[0]; if (!root) return null; const a = attrs(root); const num = (v) => (/^\s*[\d.]+\s*(px)?\s*$/.test(v ?? '') ? parseFloat(v) : NaN);
  const w = num(a.width), h = num(a.height); if (w > 0 && h > 0) return { w, h };
  const vb = a.viewBox?.trim().split(/[\s,]+/).map(Number); return vb?.length === 4 && vb[2] > 0 && vb[3] > 0 ? { w: vb[2], h: vb[3] } : null;
}
function hrefBytes(href) {
  const m = String(href).match(/^data:([^;,]+)((?:;[^;,]*)*),(.*)$/s); if (!m) return null;
  try { return { mime: m[1], bytes: /;base64/.test(m[2]) ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8') }; } catch { return null; }
}
function imageSize(href) { const d = hrefBytes(href); if (!d) return null; return d.mime === 'image/svg+xml' ? svgSize(d.bytes.toString('utf8')) : rasterSize(d.bytes); }

// ---------- geometry (as parity.mjs) ----------
const NAN_BOX = { x: NaN, y: NaN, w: NaN, h: NaN };
function imageRect(b, c = {}) { const [l, t, r, bt] = ['l', 't', 'r', 'b'].map((k) => +(c[k] ?? 0) / 100000); if (!(l + r < 1 && t + bt < 1)) return NAN_BOX;
  const w = b.w / (1 - l - r), h = b.h / (1 - t - bt); return { x: b.x - l * w, y: b.y - t * h, w, h }; }
function visibleImage(b, c = {}) { const i = imageRect(b, c); const x = Math.max(b.x, i.x), y = Math.max(b.y, i.y); return { x, y, w: Math.min(b.x + b.w, i.x + i.w) - x, h: Math.min(b.y + b.h, i.y + i.h) - y }; }
function placedImage(e) { if (/^none\b/.test(e.par)) return e; if (!e.intrinsic) return NAN_BOX; const m = e.par.match(/x(Min|Mid|Max)Y(Min|Mid|Max)/) ?? [null, 'Mid', 'Mid'];
  const k = (/slice/.test(e.par) ? Math.max : Math.min)(e.w / e.intrinsic.w, e.h / e.intrinsic.h), w = e.intrinsic.w * k, h = e.intrinsic.h * k, f = { Min: 0, Mid: 0.5, Max: 1 };
  return { x: e.x + f[m[1]] * (e.w - w), y: e.y + f[m[2]] * (e.h - h), w, h }; }
const finiteBox = (b) => ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(b?.[k]));
function geomDelta(a, b) { if (!finiteBox(a) || !finiteBox(b)) return NaN; return r3(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h)) * PX_PT); }
function cropDelta(v, a, p) { if (![v, a, p].every(finiteBox)) return NaN;
  const at = (q, a0, aw, p0, pw) => Math.abs(p0 + ((q - a0) / aw) * pw - q);
  return r3(Math.max(at(v.x, a.x, a.w, p.x, p.w), at(v.x + v.w, a.x, a.w, p.x, p.w), at(v.y, a.y, a.h, p.y, p.h), at(v.y + v.h, a.y, a.h, p.y, p.h)) * PX_PT); }
const within = (d) => d <= GEOM_TOL_PT; // NaN and Infinity are never within tolerance
const box3 = (b) => (b ? Object.fromEntries(['x', 'y', 'w', 'h'].map((k) => [k, r3(b[k])])) : null);

// ---------- preview: the <image> inside the slide-image group of a traced SVG ----------
function previewSlideImage(svg) {
  const g = svg.match(/<g\b[^>]*\bdata-opf-slide-image="([^"]*)"[^>]*>([\s\S]*?)<\/g>/); if (!g) return null;
  const tag = g[2].match(/<image\b([^>]*?)\/?>/); if (!tag) return { group: g[1], image: null };
  const a = attrs(tag[1]); const href = a.href ?? a['xlink:href'] ?? '';
  const data = hrefBytes(href);
  return { group: g[1], image: { x: +(a.x ?? 0), y: +(a.y ?? 0), w: +a.width, h: +a.height, par: a.preserveAspectRatio ?? 'xMidYMid meet', intrinsic: imageSize(href), hash: data ? sha(data.bytes) : null, sourcePath: a['data-opf-path'] ?? null } };
}

// ---------- PPTX: the picture named "OPF slide image slides.N" and its image relationship ----------
function relsOf(files, part) {
  const r = files[part.replace(/([^/]+)$/, '_rels/$1.rels')]; if (!r) return {};
  return Object.fromEntries([...new TextDecoder().decode(r).matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => attrs(m[1])).map((a) => [a.Id, a]));
}
function resolveTarget(sourcePart, target) {
  if (!target) return null;
  if (target.startsWith('/')) return path.posix.normalize(target.slice(1));
  return path.posix.normalize(path.posix.join(path.posix.dirname(sourcePart), target));
}
function slidePictures(xml, si) {
  const out = [];
  for (const m of xml.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g)) {
    const body = m[1]; const nv = attrs(body.match(/<p:cNvPr\b([^>]*)/)?.[1] ?? '');
    if (nv.name !== `OPF slide image slides.${si}`) continue;
    const off = body.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"/);
    out.push({ name: nv.name, box: off ? { x: +off[1] / 9525, y: +off[2] / 9525, w: +off[3] / 9525, h: +off[4] / 9525 } : null,
      embed: body.match(/<a:blip\b[^>]*\br:embed="([^"]+)"/)?.[1] ?? null, srcRect: attrs(body.match(/<a:srcRect\b([^>]*)\/>/)?.[1] ?? ''),
      prst: body.match(/<a:prstGeom prst="(\w+)"/)?.[1] ?? null });
  }
  return out;
}

// Probe every slide. Returns {slides: [...], native, reasons}. `native` is true only when every slide whose preview
// shows a slide image has exactly one named picture whose image relationship resolves to a package part, and no
// slide without a preview slide image has one. Geometry, crop, image bytes and shape are reported as reasons.
export function probeSlideImages({ svgs, resolved, files }) {
  const slideParts = Object.keys(files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
  const slides = [], reasons = [];
  let expected = 0, found = 0;
  for (let si = 0; si < Math.max(svgs.length, slideParts.length); si++) {
    const pv = svgs[si] ? previewSlideImage(svgs[si]) : null;
    const geo = resolved.slides[si]?.geometry?.slideImage ?? null;
    const part = slideParts[si];
    const xml = part ? new TextDecoder().decode(files[part]) : '';
    const pics = part ? slidePictures(xml, si) : [];
    const rels = part ? relsOf(files, part) : {};
    const rec = { slide: si, previewSlideImage: !!pv?.image, previewPosition: geo?.position ?? null, previewFill: geo?.fill ?? null, pictures: pics.length };
    if (pv?.image) expected++;
    if (pv?.image && pics.length !== 1) reasons.push(`slide ${si}: preview shows a slide image but the export has ${pics.length} "OPF slide image slides.${si}" pictures`);
    if (!pv?.image && pics.length) reasons.push(`slide ${si}: export has a slide-image picture but the preview shows none`);
    const pic = pics[0];
    if (pic) {
      const rel = pic.embed ? rels[pic.embed] : null; const target = rel ? resolveTarget(part, rel.Target) : null;
      rec.relationship = rel ? { id: pic.embed, type: rel.Type?.split('/').pop() ?? null, target } : null;
      rec.imagePartExists = !!(target && files[target]);
      rec.exportHash = rec.imagePartExists ? sha(files[target]) : null;
      if (!rec.imagePartExists || rec.relationship.type !== 'image') reasons.push(`slide ${si}: slide-image picture has no resolvable image relationship (${pic.embed ?? 'no r:embed'}${rel ? ` -> ${rel.Type?.split('/').pop()} ${target}` : ''})`);
      else if (pv?.image) found++;
      rec.prst = pic.prst; rec.expectedPrst = geo?.shape?.preset ?? null;
      rec.srcRect = pic.srcRect;
      if (pv?.image) {
        const img = pv.image; rec.previewHash = img.hash;
        if (img.hash && rec.exportHash && img.hash !== rec.exportHash) reasons.push(`slide ${si}: slide-image bytes differ between preview and export`);
        if (rec.expectedPrst && pic.prst !== rec.expectedPrst) reasons.push(`slide ${si}: slide-image shape ${pic.prst} vs preview ${rec.expectedPrst}`);
        if (!pic.box) { reasons.push(`slide ${si}: slide-image picture has no frame`); }
        else {
          // Frame: the picture's visible image rect vs the preview's placed image clipped to its <image> viewport.
          const measurable = !!img.intrinsic || /^none/.test(img.par);
          let ref = img;
          if (measurable) { const p = placedImage(img), x = Math.max(img.x, p.x), y = Math.max(img.y, p.y); ref = { x, y, w: Math.min(img.x + img.w, p.x + p.w) - x, h: Math.min(img.y + img.h, p.y + p.h) - y }; }
          const vis = visibleImage(pic.box, pic.srcRect);
          rec.frameDeltaPt = geomDelta(vis, ref); rec.visible = box3(vis); rec.previewVisible = box3(ref);
          if (!within(rec.frameDeltaPt)) reasons.push(`slide ${si}: slide-image frame differs from preview by ${Number.isFinite(rec.frameDeltaPt) ? rec.frameDeltaPt + ' pt' : 'a non-finite amount'}`);
          // Crop: the image content shown at the visible edges must be where the preview places it.
          if (!measurable) { rec.cropDeltaPt = null; reasons.push(`slide ${si}: slide-image crop unmeasured (preview image size unknown)`); }
          else {
            rec.cropDeltaPt = cropDelta(vis, imageRect(pic.box, pic.srcRect), placedImage(img));
            if (!within(rec.cropDeltaPt)) reasons.push(`slide ${si}: slide-image crop differs from preview by ${Number.isFinite(rec.cropDeltaPt) ? rec.cropDeltaPt + ' pt' : 'a non-finite amount'}`);
          }
        }
      }
    }
    slides.push(rec);
  }
  const native = expected > 0 && found === expected && !slides.some((s) => !s.previewSlideImage && s.pictures);
  return { native, expected, found, slides, reasons };
}
