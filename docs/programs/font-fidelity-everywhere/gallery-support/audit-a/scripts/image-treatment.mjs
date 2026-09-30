// Native image probe for the image-treatment snippets (audit A, 2026-09-30).
//
// Owner default 2026-09-30: an image treatment `works` when the treatment's actual design output, as the gallery snippet
// emits it (a layout image, an image block, a slide background image, `design.watermark`, `imageFill`, ...), is written
// natively into the PPTX and re-imports. The probe therefore starts from what the snippet emits, not from one field:
//   1. the snippet declares N image references, and the traced preview draws N images;
//   2. the export has N native image references on the slide (a `p:pic`, or the `a:blipFill` of the slide background, or of the
//      layout or master background the slide inherits), each resolving to an image part, and the image bytes equal the preview's;
//   3. a `design.watermark` is the picture named `OPF watermark` with `a:alphaModFix` equal to its opacity, and a background image
//      opacity is the `a:alphaModFix` of the background blip;
//   4. `fromPptx` returns the same number of images with the same bytes, and keeps `design.watermark`, the image background (and
//      its opacity) and `design.imageFill` where the snippet set them.
// Frames and crops are the parity audit's checks (FF-38, 0.02 pt), not repeated here. A treatment the OPF v1 schema cannot
// express (mask, blur, duotone, frame) is still `works` here when its emitted composition is native; the gallery's own label
// (`native`, `composed`, `gap`) travels in `gallery.opfSupport` and the gap note explains what the export does not do.
import { createHash } from 'node:crypto';
import path from 'node:path';
import { hrefBytes } from './slide-image.mjs';

const dec = new TextDecoder();
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attrs = (s) => Object.fromEntries([...String(s).matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], unesc(m[2])]));
const sorted = (a) => [...a].sort();

function relsOf(files, part) {
  const r = files[part.replace(/([^/]+)$/, '_rels/$1.rels')];
  if (!r) return {};
  return Object.fromEntries([...dec.decode(r).matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => attrs(m[1])).map((a) => [a.Id, a]));
}
function resolveTarget(sourcePart, target) {
  if (!target) return null;
  if (target.startsWith('/')) return path.posix.normalize(target.slice(1));
  return path.posix.normalize(path.posix.join(path.posix.dirname(sourcePart), target));
}
const relationOf = (files, part, type) => Object.values(relsOf(files, part)).filter((r) => r.Type?.split('/').pop() === type).map((r) => resolveTarget(part, r.Target));

// The images a snippet declares: an `image` object or `asset:` string under any node, and `watermark`. `asset:<id>` resolves to
// its own asset entry so that the count and the bytes can be compared.
export function declaredImages(doc) {
  const assets = doc.assets ?? {};
  const bytesOf = (src) => {
    if (typeof src !== 'string') return null;
    if (src.startsWith('asset:')) return bytesOf(assets[src.slice(6)]?.src);
    return hrefBytes(src)?.bytes ?? null;
  };
  const out = [];
  const add = (where, src) => out.push({ where, src: typeof src === 'string' ? src.slice(0, 40) : null, hash: (() => { const b = bytesOf(src); return b ? sha(b) : null; })() });
  const walk = (node, at) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${at}.${i}`)); return; }
    if (node.image && typeof node.image === 'object' && node.image.src !== undefined) add(`${at}.image`, node.image.src);
    else if (typeof node.image === 'string') add(`${at}.image`, node.image);
    if (node.watermark && typeof node.watermark === 'object' && node.watermark.src !== undefined) add(`${at}.watermark`, node.watermark.src);
    for (const [k, v] of Object.entries(node)) if (k !== 'assets' && k !== 'catalogs' && typeof v === 'object') walk(v, at ? `${at}.${k}` : k);
  };
  walk(doc, '');
  return out;
}

function previewImages(svg) {
  return [...svg.matchAll(/<image\b([^>]*?)\/?>/g)].map((m) => {
    const a = attrs(m[1]);
    const d = hrefBytes(a.href ?? a['xlink:href'] ?? '');
    return { path: a['data-opf-path'] ?? null, hash: d ? sha(d.bytes) : null };
  });
}

// Native image references that show on one slide: its pictures, its background blip, and the background blip of the layout
// and master it inherits when it has none of its own.
function nativeImages(files, part) {
  const xml = dec.decode(files[part]);
  const refs = [];
  const resolveEmbed = (owner, embed) => {
    const rel = relsOf(files, owner)[embed];
    const target = rel ? resolveTarget(owner, rel.Target) : null;
    return { embed, relType: rel?.Type?.split('/').pop() ?? null, target, exists: !!(target && files[target]), hash: target && files[target] ? sha(files[target]) : null };
  };
  const bgOf = (owner, ownerXml) => [...(ownerXml.match(/<p:bg>[\s\S]*?<\/p:bg>/)?.[0] ?? '').matchAll(/<a:blip\b([^>]*)>([\s\S]*?)<\/a:blip>|<a:blip\b([^>]*?)\/>/g)].map((m) => {
    const a = attrs(m[1] ?? m[3]);
    return { kind: 'background', owner, ...resolveEmbed(owner, a['r:embed']), alphaModFix: m[2]?.match(/<a:alphaModFix amt="(\d+)"/)?.[1] ?? null };
  });
  for (const m of xml.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g)) {
    const body = m[1];
    const blip = body.match(/<a:blip\b([^>]*)>([\s\S]*?)<\/a:blip>|<a:blip\b([^>]*?)\/>/);
    const a = attrs(blip?.[1] ?? blip?.[3] ?? '');
    refs.push({ kind: 'picture', name: attrs(body.match(/<p:cNvPr\b([^>]*)/)?.[1] ?? '').name ?? null, ...resolveEmbed(part, a['r:embed']), alphaModFix: blip?.[2]?.match(/<a:alphaModFix amt="(\d+)"/)?.[1] ?? null });
  }
  const own = bgOf(part, xml);
  refs.push(...own);
  if (!own.length) {
    const layout = relationOf(files, part, 'slideLayout')[0];
    const master = layout && relationOf(files, layout, 'slideMaster')[0];
    for (const owner of [layout, master]) if (owner && files[owner]) refs.push(...bgOf(owner, dec.decode(files[owner])));
  }
  // Any other a:blip (for example an image fill on a shape) is a native image reference too.
  const total = [...xml.matchAll(/<a:blip\b/g)].length;
  const counted = refs.filter((r) => r.owner === undefined || r.owner === part).length;
  return { refs, otherBlips: Math.max(0, total - counted) };
}

// Images in an imported document, with each `asset:` resolved.
function importedImages(doc) {
  return declaredImages(doc);
}

export function probeTreatmentImages({ doc, svgs, files, imported }) {
  const reasons = [];
  const slideParts = Object.keys(files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
  const declared = declaredImages(doc);
  const preview = svgs.map(previewImages);
  const previewCount = preview.reduce((n, s) => n + s.length, 0);
  const slides = [];
  let found = 0;
  if (!previewCount) reasons.push('the snippet draws no image in the preview');
  if (declared.length !== previewCount) reasons.push(`the snippet declares ${declared.length} image references but the preview draws ${previewCount}`);
  for (let si = 0; si < Math.max(svgs.length, slideParts.length); si++) {
    const part = slideParts[si];
    const pv = preview[si] ?? [];
    const { refs, otherBlips } = part ? nativeImages(files, part) : { refs: [], otherBlips: 0 };
    const rec = { slide: si, previewImages: pv.length, nativeReferences: refs.length, otherBlips, references: refs.map((r) => ({ kind: r.kind, name: r.name ?? null, target: r.target, hash: r.hash, alphaModFix: r.alphaModFix })) };
    slides.push(rec);
    const unresolved = refs.filter((r) => !r.exists || r.relType !== 'image');
    for (const r of unresolved) reasons.push(`slide ${si}: a native ${r.kind} has no resolvable image part (${r.embed ?? 'no r:embed'}${r.relType ? ` -> ${r.relType}` : ''})`);
    if (refs.length + otherBlips !== pv.length) reasons.push(`slide ${si}: the preview draws ${pv.length} images, the export has ${refs.length + otherBlips} native image references`);
    else if (JSON.stringify(sorted(refs.map((r) => r.hash))) !== JSON.stringify(sorted(pv.map((p) => p.hash))) && !otherBlips) reasons.push(`slide ${si}: image bytes differ between the preview and the export`);
    else if (!unresolved.length) found += pv.length;
  }
  // design.watermark: one picture named "OPF watermark", opacity as a:alphaModFix.
  const watermark = doc.design?.watermark;
  if (watermark) {
    const opacity = watermark.opacity ?? 1;
    const pics = slides.flatMap((s) => s.references).filter((r) => r.name === 'OPF watermark');
    if (pics.length !== slides.length) reasons.push(`design.watermark: ${pics.length} "OPF watermark" pictures for ${slides.length} slides`);
    for (const p of pics) if (opacity < 1 && Math.abs(Number(p.alphaModFix ?? 100000) - opacity * 100000) > 1) reasons.push(`design.watermark: opacity ${opacity} exports as alphaModFix ${p.alphaModFix ?? 'none'}`);
  }
  // A background image's opacity is the alphaModFix of the background blip.
  const bg = doc.design?.background;
  if (bg?.type === 'image') {
    const opacity = bg.opacity ?? 1;
    const bgRefs = slides.flatMap((s) => s.references).filter((r) => r.kind === 'background');
    if (!bgRefs.length) reasons.push('the image background is not a native a:blipFill background');
    for (const r of bgRefs) if (opacity < 1 && Math.abs(Number(r.alphaModFix ?? 100000) - opacity * 100000) > 1) reasons.push(`image background opacity ${opacity} exports as alphaModFix ${r.alphaModFix ?? 'none'}`);
  }
  const native = previewCount > 0 && reasons.length === 0;

  // Re-import: the same images, and the design keys the snippet set for the treatment.
  const re = { ok: !!imported, images: null, missing: [] };
  if (imported) {
    const got = importedImages(imported);
    re.images = got.length;
    const want = sorted(preview.flat().map((p) => p.hash)), have = sorted(got.map((g) => g.hash));
    if (got.length !== previewCount) re.missing.push(`re-import returns ${got.length} images, the preview draws ${previewCount}`);
    else if (JSON.stringify(want) !== JSON.stringify(have)) re.missing.push('re-import returns different image bytes');
    const idesign = imported.design ?? {}, sdesign = imported.slides?.[0]?.design ?? {};
    const imgBg = sdesign.background ?? idesign.background;
    if (doc.design?.imageFill && (idesign.imageFill ?? sdesign.imageFill) !== doc.design.imageFill) re.missing.push(`design.imageFill ${doc.design.imageFill} is not returned`);
    if (bg?.type === 'image') {
      if (imgBg?.type !== 'image') re.missing.push('the image background is not returned');
      else if (bg.opacity !== undefined && imgBg.opacity !== bg.opacity) re.missing.push(`image background opacity ${bg.opacity} is returned as ${imgBg.opacity ?? 'none'}`);
    }
    if (watermark) {
      const w = idesign.watermark ?? sdesign.watermark;
      if (!w) re.missing.push('design.watermark is not returned');
      else if (watermark.opacity !== undefined && w.opacity !== watermark.opacity) re.missing.push(`design.watermark opacity ${watermark.opacity} is returned as ${w.opacity ?? 'none'}`);
    }
  } else re.missing.push('re-import did not run');
  return { native, expected: previewCount, declared: declared.length, found, slides, reasons, reimport: re };
}
