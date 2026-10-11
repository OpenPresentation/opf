// Shared helpers for the opf#323 0.18 native set builders. Published packages only (see ../package.json). No Office.
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync, strFromU8} from 'fflate';
import {validate} from '@openpresentation/opf';
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toSvg} from '@openpresentation/opf-render';
import {toPng} from '@openpresentation/opf-render/png';
import {toPptx, inventoryTypefaces, packageFontsUsed} from '@openpresentation/opf-pptx';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ZIP_DATE = '2026-10-10T00:00:00Z';
// FF-27: the host date handed to the exporter for `date: true`. A past date on purpose: a live field must read the clock natively.
export const EXPORT_DATE = '2026-01-15';
export const catalogs = [defaultCatalog];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const version = name => JSON.parse(readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version;
export const PACKAGES = Object.fromEntries(['@openpresentation/opf', '@openpresentation/opf-render', '@openpresentation/opf-pptx', '@openpresentation/opf-editor', 'fontkit'].map(name => [name, version(name)]));

let fontsPromise;
/** The gallery-style font host (visual substitutes allowed), every script face loaded: what the preview draws. */
export const fonts = () => (fontsPromise ??= loadFonts({pack: 'office', scripts: 'all', substitutionPolicy: 'visual', renderOptions: {catalogs}}));

export function check(deck, id) {
  const report = validate(deck, {catalogs});
  const errors = (report.findings ?? []).filter(f => f.severity === 'error');
  if (errors.length) throw new Error(`${id}: invalid OPF\n${JSON.stringify(errors.slice(0, 5), null, 1)}`);
  return (report.findings ?? []).filter(f => f.severity === 'warning').map(f => ({rule: f.ruleId, path: f.path, message: f.message?.slice(0, 200)}));
}

/** Export one deck; returns {bytes, diagnostics}. */
export async function exportDeck(deck, extra = {}) {
  const diagnostics = [];
  const bytes = await toPptx(deck, {catalogs, fonts: await fonts(), zipDate: ZIP_DATE, date: EXPORT_DATE, onDiagnostic: d => diagnostics.push({code: d.code, path: d.path, message: String(d.message ?? '').slice(0, 200)}), ...extra});
  return {bytes, diagnostics};
}

/** Preview PNGs of every slide at `width` px, the same pixel size the native reader exports. */
export async function previews(deck, outDir, id, width = 1280) {
  const handle = await fonts();
  await handle.ensure(deck, {renderOptions: {catalogs}});
  const svgs = toSvg(deck, {fonts: handle, catalogs, date: EXPORT_DATE});
  const files = [];
  mkdirSync(outDir, {recursive: true});
  for (const [i, svg] of svgs.entries()) {
    const png = await toPng(svg, {fonts: handle, width});
    const file = path.join(outDir, `${id}-slide-${i + 1}.preview.png`);
    writeFileSync(file, png);
    files.push(path.basename(file));
  }
  return files;
}

const attr = (xml, name) => { const m = new RegExp(`\\b${name}="([^"]*)"`).exec(xml); return m ? m[1] : undefined; };
const decode = s => s?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** What the package says: theme slots (every theme part), runs per slide, fields, notes, charts, tables, slide size, fonts used. */
export function inspectPptx(bytes) {
  const files = unzipSync(bytes);
  const text = name => files[name] ? strFromU8(files[name]) : undefined;
  const inv = inventoryTypefaces(bytes);
  const slides = Object.keys(files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const presentation = text('ppt/presentation.xml');
  const sldSz = /<p:sldSz\b[^>]*>/.exec(presentation)?.[0] ?? '';
  const perSlide = slides.map((part, i) => {
    const xml = text(part);
    const shapes = [];
    for (const sp of xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
      const body = sp[1];
      const name = decode(attr(/<p:cNvPr\b[^>]*>/.exec(body)?.[0] ?? '', 'name'));
      const ph = /<p:ph\b[^>]*>/.exec(body)?.[0];
      const off = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(body), ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(body);
      const runs = [...body.matchAll(/<a:(r|fld)\b([^>]*)>([\s\S]*?)<\/a:\1>/g)].map(r => {
        const rPr = /<a:rPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/.exec(r[3])?.[0] ?? '';
        return {kind: r[1], fieldType: r[1] === 'fld' ? attr(r[2], 'type') : undefined, text: decode(/<a:t>([\s\S]*?)<\/a:t>/.exec(r[3])?.[1] ?? ''), lang: attr(rPr, 'lang'),
          latin: decode(attr(/<a:latin\b[^>]*>/.exec(rPr)?.[0] ?? '', 'typeface')), ea: decode(attr(/<a:ea\b[^>]*>/.exec(rPr)?.[0] ?? '', 'typeface')), cs: decode(attr(/<a:cs\b[^>]*>/.exec(rPr)?.[0] ?? '', 'typeface')),
          size: attr(rPr, 'sz') ? Number(attr(rPr, 'sz')) / 100 : undefined, bold: attr(rPr, 'b') === '1', italic: attr(rPr, 'i') === '1'};
      });
      shapes.push({name, placeholder: ph ? attr(ph, 'type') ?? 'body' : undefined, box: off && ext ? {x: +off[1] / 12700, y: +off[2] / 12700, w: +ext[1] / 12700, h: +ext[2] / 12700} : undefined, runs, rtl: /<a:pPr\b[^>]*\brtl="1"/.test(body)});
    }
    const rels = text(part.replace('slides/', 'slides/_rels/') + '.rels') ?? '';
    const notesPart = /Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/.exec(rels)?.[1];
    const notesXml = notesPart ? text(`ppt/notesSlides/${notesPart}`) : undefined;
    const notesText = notesXml ? [...notesXml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].filter(m => /<p:ph type="body"/.test(m[1])).map(m => [...m[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(t => decode(t[1])).join('')).join('') : '';
    return {index: i + 1, part, shapes, charts: (rels.match(/relationships\/chart"|chartEx/g) ?? []).length, tables: (xml.match(/<a:tbl>/g) ?? []).length, notesText};
  });
  return {
    slideSize: {cx: Number(attr(sldSz, 'cx')), cy: Number(attr(sldSz, 'cy'))},
    themes: inv.themes, themeParts: inv.themeParts, fontsUsed: inv.fontsUsed, packageFonts: packageFontsUsed(inv),
    typefaces: [...new Set(inv.typefaces.map(t => t.typeface).filter(Boolean))].sort(),
    slides: perSlide,
  };
}

export function writeJson(file, value) { mkdirSync(path.dirname(file), {recursive: true}); writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
