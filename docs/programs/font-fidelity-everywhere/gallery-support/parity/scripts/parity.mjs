// Parity layer: for every pptx.gallery value document, compare the opf-render preview model (traced SVG + resolved
// geometry) against the exported PPTX, element by element. No Office. Read-only against product repos.
// Run via run.ps1 (or: node --import <core>/scripts/register-local-opf.mjs parity.mjs). Env:
//   PARITY_PREFIX  worktree prefix under ../../../sources (default "parity": <prefix>-opf, -opf-render, -opf-pptx)
//   ONLY=dim1,dim2  LIMIT=n  OUT=<results path>
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const SRC = path.resolve(ROOT, '../../sources');
const PFX = process.env.PARITY_PREFIX ?? 'parity';
const CORE = path.join(SRC, `${PFX}-opf`), RENDER = path.join(SRC, `${PFX}-opf-render`), PPTX = path.join(SRC, `${PFX}-opf-pptx`), GALLERY = process.env.GALLERY_DIR ?? path.join(SRC, `${PFX}-pptx-gallery`);
const imp = p => import(pathToFileURL(p).href);
const render = await imp(path.join(RENDER, 'dist/index.js'));
const {prepareNodeFonts} = await imp(path.join(RENDER, 'dist/fonts-node.js'));
const {toPptx, fromPptx} = await imp(path.join(PPTX, 'dist/index.js'));
// Core's default text measurement: the same estimate both engines use here (no host registry).
const {measureText} = await imp(path.join(CORE, 'packages/javascript/dist/index.js'));
const {unzipSync} = createRequire(path.join(PPTX, 'package.json'))('fflate');
const head = d => { try { return execFileSync('git', ['-C', d, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(); } catch { return null; } };

const ONLY = process.env.ONLY?.split(','); const LIMIT = Number(process.env.LIMIT ?? Infinity);
const snippets = JSON.parse(await readFile(path.join(ROOT, 'out/snippets.json'), 'utf8')).filter(s => !ONLY || ONLY.includes(s.dimension));
const office = await prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual'});

// ---------- tolerances ----------
const TOL = {geomPt: 0.02, geomNearPt: 0.5, sizePt: 0.005, sizeNearPt: 0.5};
const EMU_PT = 12700, PX_PT = 0.75;
const r3 = n => Math.round(n * 1000) / 1000;
const dec = new TextDecoder();
const uniq = a => [...new Set(a)];
const normText = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const firstFamily = f => String(f ?? '').split(',')[0].trim().replace(/^["']|["']$/g, '');
const hex = c => { if (!c) return null; const m = String(c).match(/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i); if (m) return m[1].toUpperCase(); const s = String(c).match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i); return s ? (s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase() : String(c); };
const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
const attrs = s => Object.fromEntries([...String(s).matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], unesc(m[2])]));
const sha = b => createHash('sha256').update(b).digest('hex').slice(0, 16);
const scriptOf = t => /[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF\u3040-\u30FF]/u.test(t) ? 'ea' : /[\u0590-\u08FF\u0900-\u0DFF\u0E00-\u0EFF\u1000-\u109F\u10A0-\u10FF\u1200-\u137F\u1780-\u17FF]/u.test(t) ? 'cs' : 'latin';

// ---------- preview model (traced SVG) ----------
function parseSvg(svg) {
  const out = {viewBox: null, elements: [], boxes: []};
  const stack = []; let cur = null;
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    if (m[5] !== undefined) { if (cur && (cur.tag === 'text')) { const t = unesc(m[5]); const top = stack[stack.length - 1]; if (top?.tag === 'tspan') top.runs.push({text: t, a: top.a}); else cur.runs.push({text: t, a: cur.a}); } continue; }
    const [, close, tag, rawAttrs, self] = m;
    if (close) { const top = stack.pop(); if (top?.tag === 'tspan' && cur) cur.runs.push(...top.runs); if (top?.tag === 'text') cur = null; continue; }
    const parent = stack[stack.length - 1];
    const a = {...(tag === 'tspan' || tag === 'text' ? parent?.inherit ?? {} : {}), ...attrs(rawAttrs)};
    const p = a['data-opf-path'] ?? parent?.path ?? null;
    const node = {tag, a, path: p, runs: [], inherit: tag === 'text' || tag === 'tspan' ? a : parent?.inherit ?? {}};
    if (tag === 'svg') out.viewBox = a.viewBox?.split(/\s+/).map(Number);
    if (tag === 'g' && a['data-opf-box-x'] !== undefined) out.boxes.push({path: p, x: +a['data-opf-box-x'], y: +a['data-opf-box-y'], w: +a['data-opf-box-width'], h: +a['data-opf-box-height']});
    if (tag === 'text') { cur = node; out.elements.push({kind: 'text', path: p, a, runs: node.runs}); }
    else if (['rect', 'circle', 'ellipse', 'path', 'polygon', 'line', 'image', 'polyline'].includes(tag)) {
      const el = {kind: tag === 'image' ? 'image' : 'shape', tag, path: p, fill: a.fill ?? null, stroke: a.stroke ?? null};
      if (tag === 'rect' || tag === 'image') Object.assign(el, {x: +(a.x ?? 0), y: +(a.y ?? 0), w: +a.width, h: +a.height});
      if (tag === 'image') { const href = a.href ?? a['xlink:href'] ?? ''; const b64 = href.match(/^data:[^;]+;base64,(.*)$/); el.hash = b64 ? sha(Buffer.from(b64[1], 'base64')) : href.slice(0, 40); el.mime = href.match(/^data:([^;]+)/)?.[1] ?? null; el.par = a.preserveAspectRatio ?? 'xMidYMid meet'; if (b64) { const buf = Buffer.from(b64[1].slice(0, 64), 'base64'); if (buf.slice(1, 4).toString() === 'PNG') el.intrinsic = {w: buf.readUInt32BE(16), h: buf.readUInt32BE(20)}; } }
      out.elements.push(el);
    }
    if (!self && tag !== 'text' || (tag === 'text' && !self)) stack.push(node);
  }
  for (const e of out.elements) if (e.kind === 'text') {
    e.text = e.runs.map(r => r.text).join('');
    e.runs = e.runs.filter(r => r.text.length).map(r => ({text: r.text, family: firstFamily(r.a['font-family']), sizePt: r3(+r.a['font-size'] * PX_PT), bold: +(r.a['font-weight'] ?? 400) >= 600 || r.a['font-weight'] === 'bold', italic: r.a['font-style'] === 'italic', color: hex(r.a.fill)}));
    e.anchor = e.a['text-anchor'] ?? 'start'; e.x = +e.a.x; e.y = +e.a.y;
  }
  return out;
}

// ---------- PPTX model ----------
function themeInfo(xml) {
  const clr = {};
  for (const m of xml.matchAll(/<a:(dk1|lt1|dk2|lt2|accent[1-6]|hlink|folHlink)>(.*?)<\/a:\1>/gs)) clr[m[1]] = (m[2].match(/(?:val|lastClr)="([0-9A-Fa-f]{6})"/g) ?? []).map(v => v.slice(-7, -1).toUpperCase()).pop();
  const font = k => { const b = xml.match(new RegExp(`<a:${k}>(.*?)</a:${k}>`, 's'))?.[1] ?? ''; return {latin: b.match(/<a:latin typeface="([^"]*)"/)?.[1], ea: b.match(/<a:ea typeface="([^"]*)"/)?.[1], cs: b.match(/<a:cs typeface="([^"]*)"/)?.[1], scripts: [...b.matchAll(/<a:font script="([^"]*)" typeface="([^"]*)"/g)].map(m => `${m[1]}=${m[2]}`)}; };
  return {clr, major: font('majorFont'), minor: font('minorFont')};
}
const CLRMAP = {bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2'};
function fillOf(xml, theme) {
  const f = xml.match(/<a:(solidFill|gradFill|blipFill|noFill|pattFill)\b[^>]*?(?:\/>|>(.*?)<\/a:\1>)/s); if (!f) return null;
  if (f[1] !== 'solidFill') return {kind: f[1]};
  const s = f[2].match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/); if (s) return {kind: 'solid', rgb: s[1].toUpperCase(), via: 'srgb'};
  const sc = f[2].match(/<a:schemeClr val="(\w+)"/); if (sc) return {kind: 'solid', rgb: theme.clr[CLRMAP[sc[1]] ?? sc[1]] ?? null, via: `scheme:${sc[1]}`};
  return {kind: 'solid', rgb: null, via: 'other'};
}
function parseParagraphs(txXml, theme, defaults = {}) {
  return [...txXml.matchAll(/<a:p>(.*?)<\/a:p>/gs)].map(pm => {
    const p = pm[1]; const pPr = p.match(/<a:pPr\b([^>]*)/)?.[1] ?? ''; const pa = attrs(pPr); const algn = pa.algn ?? 'l'; const bu = unesc(p.match(/<a:buChar char="([^"]*)"/)?.[1] ?? '') || (p.includes('<a:buAutoNum') ? '#auto' : null);
    const runs = [...p.matchAll(/<a:(r|fld)>(.*?)<\/a:\1>/gs)].map(rm => {
      const rPr = rm[2].match(/<a:rPr\b([^>]*?)(?:\/>|>(.*?)<\/a:rPr>)/s); const ra = attrs(rPr?.[1] ?? ''), inner = rPr?.[2] ?? '';
      const text = unesc(rm[2].match(/<a:t>(.*?)<\/a:t>/s)?.[1] ?? '');
      const tf = k => inner.match(new RegExp(`<a:${k} typeface="([^"]*)"`))?.[1];
      return {text, latin: tf('latin'), ea: tf('ea'), cs: tf('cs'), sizePt: ra.sz ? +ra.sz / 100 : defaults.sizePt ?? null, bold: ra.b === '1', italic: ra.i === '1', fill: fillOf(inner, theme), lang: ra.lang ?? null};
    });
    return {algn, marL: +(pa.marL ?? 0) / 9525, indent: +(pa.indent ?? 0) / 9525, bullet: bu, runs, text: runs.map(r => r.text).join('')};
  }).filter(p => p.runs.length);
}
// OPC part-name resolution: an absolute Target ("/ppt/charts/chart1.xml") is
// relative to the package root; a relative Target is relative to the folder of
// the source part.
function resolveTarget(sourcePart, target) {
  if (!target) return null;
  if (target.startsWith('/')) return path.posix.normalize(target.slice(1));
  return path.posix.normalize(path.posix.join(path.posix.dirname(sourcePart), target));
}
function parseSlide(xml, rels, files, theme, slidePart) {
  const bg = xml.match(/<p:bg>(.*?)<\/p:bg>/s)?.[1]; const shapes = [];
  const tree = xml.match(/<p:spTree>(.*)<\/p:spTree>/s)?.[1] ?? '';
  let order = 0;
  for (const m of tree.matchAll(/<p:(sp|pic|graphicFrame|cxnSp)>(.*?)<\/p:\1>/gs)) {
    const [, kind, body] = m; const nv = body.match(/<p:cNvPr\b([^>]*)/)?.[1] ?? ''; const na = attrs(nv);
    const off = body.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"/);
    const box = off ? {x: +off[1] / 9525, y: +off[2] / 9525, w: +off[3] / 9525, h: +off[4] / 9525} : null;
    const s = {kind, order: order++, id: na.id, name: na.name ?? '', box, prst: body.match(/<a:prstGeom prst="(\w+)"/)?.[1] ?? null};
    const spPr = body.match(/<p:spPr>(.*?)<\/p:spPr>/s)?.[1]; if (spPr) s.fill = fillOf(spPr.replace(/<a:ln\b.*?<\/a:ln>/s, ''), theme);
    const tx = body.match(/<p:txBody>(.*?)<\/p:txBody>/s)?.[1] ?? (body.includes('<a:tbl>') ? body : null);
    if (tx) s.paragraphs = parseParagraphs(tx, theme);
    if (body.includes('<a:tbl>')) { s.table = true; s.cellFills = uniq([...body.matchAll(/<a:tcPr\b[^>]*>(.*?)<\/a:tcPr>/gs)].map(t => fillOf(t[1].replace(/<a:ln\w\b.*?<\/a:ln\w>/gs, ''), theme)?.rgb).filter(Boolean)); }
    const blip = body.match(/<a:blip r:embed="([^"]+)"/)?.[1]; if (blip) { const target = rels[blip]; const part = resolveTarget(slidePart, target); s.image = {part, hash: files[part] ? sha(files[part]) : null}; }
    const chartRid = body.match(/<c:chart\b[^>]*r:id="([^"]+)"/)?.[1];
    if (chartRid) { const part = resolveTarget(slidePart, rels[chartRid]); const cx = files[part] ? dec.decode(files[part]) : ''; s.chart = {part, colors: uniq([...cx.matchAll(/<c:ser>.*?<c:spPr>.*?<a:srgbClr val="([0-9A-Fa-f]{6})"/gs)].map(x => x[1].toUpperCase())), typefaces: uniq([...cx.matchAll(/<a:latin typeface="([^"]*)"/g)].map(x => x[1])), sizes: uniq([...cx.matchAll(/<a:defRPr\b[^>]*\bsz="(\d+)"/g)].map(x => +x[1] / 100)), strings: [...cx.matchAll(/<c:v>([^<]*)<\/c:v>/g)].map(x => unesc(x[1]))}; }
    shapes.push(s);
  }
  return {bg: bg ? fillOf(bg, theme) ?? {kind: 'ref'} : null, shapes};
}
function relsOf(files, part) { const r = files[part.replace(/([^/]+)$/, '_rels/$1.rels')]; return r ? Object.fromEntries([...dec.decode(r).matchAll(/<Relationship\b([^>]*)\/?>/g)].map(m => attrs(m[1])).map(a => [a.Id, a.Target])) : {}; }

// ---------- typeface inventory (FF-08 idea) ----------
function inventory(files) {
  const out = {typefaces: [], scriptSupplements: [], appFonts: []};
  const walk = (zip, prefix) => { for (const [name, data] of Object.entries(zip)) {
    const part = prefix + name;
    if (/\.(xlsx|xlsm)$/i.test(name)) { walk(unzipSync(data), part + '!/'); continue; }
    if (!/\.(xml|rels)$/i.test(name)) continue;
    const xml = dec.decode(data);
    for (const m of xml.matchAll(/<a:(latin|ea|cs|sym|buFont)\b[^>]*\btypeface="([^"]*)"/g)) out.typefaces.push({part, tag: m[1], typeface: m[2]});
    for (const m of xml.matchAll(/<a:font script="([^"]*)" typeface="([^"]*)"/g)) out.scriptSupplements.push(`${m[1]}=${m[2]}`);
    if (part.includes('!/')) for (const m of xml.matchAll(/<(?:x:)?name val="([^"]*)"/g)) out.typefaces.push({part, tag: 'xlsx-font', typeface: m[1]});
    if (part === 'docProps/app.xml') { const fonts = xml.match(/<vt:lpstr>Fonts Used<\/vt:lpstr>.*?<vt:i4>(\d+)/s); const titles = [...xml.matchAll(/<vt:lpstr>([^<]*)<\/vt:lpstr>/g)].map(m => m[1]); out.appFonts = fonts ? titles.slice(titles.indexOf('Fonts Used') >= 0 ? 0 : 0) : titles; }
  } };
  walk(files, '');
  return out;
}

// ---------- font resolution (preview) ----------
const fontCache = new Map();
function resolveFamily(family, weight = 400, italic = false) {
  const k = `${family}|${weight}|${italic}`; if (fontCache.has(k)) return fontCache.get(k);
  let v; try { const r = office.registry.resolveFont({fontFamily: family, fontWeight: weight, italic}); v = {status: r.compatibility === 'exact' ? 'real' : r.compatibility === 'metric' ? 'metric-substitute' : r.compatibility === 'generic' ? 'missing' : 'visual-substitute', resolved: r.resolvedFamily}; }
  catch (e) { v = {status: 'missing', resolved: null, error: e.code}; }
  fontCache.set(k, v); return v;
}

// ---------- helpers ----------
const center = b => ({x: b.x + b.w / 2, y: b.y + b.h / 2});
const inside = (pt, b) => pt.x >= b.x - 0.5 && pt.x <= b.x + b.w + 0.5 && pt.y >= b.y - 0.5 && pt.y <= b.y + b.h + 0.5;
const pathFromName = n => n.match(/^OPF (?:heading|text|card|table|image|chart|code|metric|quote|list) (slides\.\d+\.\S+?)(?: line \d+| part \d+)?$/)?.[1] ?? null;
const pxToPt = v => r3(v * PX_PT);
function geomDelta(a, b) { return r3(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h)) * PX_PT); }
const bucket = d => d > 50 ? '>50' : d > 5 ? '>5' : d > TOL.geomNearPt ? '>0.5' : '<=0.5';
function sev(dPt) { return dPt <= TOL.geomPt ? 'pass' : dPt <= TOL.geomNearPt ? 'near' : 'fail'; }

function compareValue(doc) {
  const diffs = []; const checks = {};
  const add = (check, status, reason, detail) => { diffs.push({check, status, reason, ...(detail ? {detail} : {})}); };
  // Preview
  const pdiag = []; let svgs, resolved;
  try { resolved = render.resolvePresentation(structuredClone(doc), {}); svgs = render.renderSvgDeck(structuredClone(doc), {trace: true, onDiagnostic: d => pdiag.push(d.code)}); }
  catch (e) { return {fatal: `preview threw ${e.code ?? e.name}`, message: String(e.message).slice(0, 200)}; }
  return {resolved, svgs, pdiag};
}

async function parity(doc) {
  const pv = compareValue(doc); if (pv.fatal) return {class: 'mismatch', fatal: pv.fatal, message: pv.message, checks: {}, diffs: [{check: 'preview', status: 'fail', reason: pv.fatal}]};
  const {resolved, svgs} = pv;
  const ediag = []; let bytes;
  try { bytes = await toPptx(structuredClone(doc), {onDiagnostic: d => ediag.push(d.code), seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'}); }
  catch (e) { return {class: 'mismatch', fatal: `export threw ${e.code ?? e.name}`, message: String(e.message).slice(0, 200), checks: {}, diffs: [{check: 'export', status: 'fail', reason: `export threw ${e.code ?? e.name}`}]}; }
  const files = unzipSync(bytes); const theme = themeInfo(dec.decode(files['ppt/theme/theme1.xml'] ?? new Uint8Array()));
  const diffs = []; const add = (check, status, reason, where, sample) => diffs.push({check, status, reason, ...(where ? {where} : {}), ...(sample !== undefined ? {sample: String(sample).slice(0, 80)} : {})});
  const stats = {textLines: 0, textLinesMatched: 0, runs: 0, shapesMapped: 0, shapesUnmapped: 0, srgbLiteral: 0, schemeClr: 0, geomMaxDeltaPt: 0};

  // (5) slide size
  const pres = dec.decode(files['ppt/presentation.xml']); const sz = pres.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
  const pvb = parseSvg(svgs[0]).viewBox; const pptSize = [+sz[1] / EMU_PT, +sz[2] / EMU_PT], pvSize = [pvb[2] * PX_PT, pvb[3] * PX_PT];
  const sizeDelta = r3(Math.max(Math.abs(pptSize[0] - pvSize[0]), Math.abs(pptSize[1] - pvSize[1])));
  if (sizeDelta > TOL.geomPt) add('slideSize', 'fail', `slide size differs by ${sizeDelta}pt`, `${pvSize.map(r3)} vs ${pptSize.map(r3)}`);

  const slideParts = Object.keys(files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
  if (slideParts.length !== svgs.length) add('zOrder', 'fail', `slide count ${svgs.length} preview vs ${slideParts.length} pptx`);
  const chosenFamilies = new Set(); const fontRes = {};
  for (let si = 0; si < Math.min(svgs.length, slideParts.length); si++) {
    const P = parseSvg(svgs[si]); const X = parseSlide(dec.decode(files[slideParts[si]]), relsOf(files, slideParts[si]), files, theme, slideParts[si]);
    const bound = resolved.slides[si];
    for (const f of Object.values(bound.design.fonts ?? {})) if (f) chosenFamilies.add(firstFamily(f));
    // Items: resolved geometry items + SVG boxes not under an item.
    const items = bound.geometry.items.map(it => ({path: it.path, field: it.field, type: it.type, box: {x: it.box.x, y: it.box.y, w: it.box.width, h: it.box.height}, frame: it.frameBox ? {x: it.frameBox.x, y: it.frameBox.y, w: it.frameBox.width, h: it.frameBox.height} : null}));
    const under = p => items.find(it => p === it.path || p?.startsWith(it.path + '.'));
    for (const b of P.boxes) if (b.path && !under(b.path) && !items.some(i => i.path === b.path)) items.push({path: b.path, field: 'furniture', type: 'text', box: b});
    const keyOfPreview = p => { if (!p) return 'slide'; const it = items.filter(i => p === i.path || p.startsWith(i.path + '.')).sort((a, b) => b.path.length - a.path.length)[0]; return it?.path ?? p; };
    const keyOfShape = s => { const byName = pathFromName(s.name); if (byName) { const it = items.find(i => byName === i.path || byName.startsWith(i.path + '.')); return it?.path ?? byName; }
      if (s.name.startsWith('OPF card ')) return s.name.slice(9);
      if (!s.box) return 'unmapped'; const c = center(s.box); const cand = items.filter(i => inside(c, i.frame && s.name.startsWith('OPF card') ? i.frame : i.box)).sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h)[0]; return cand?.path ?? 'unmapped'; };
    const groups = new Map(); const g = k => { if (!groups.has(k)) groups.set(k, {pv: [], px: [], firstPv: Infinity, firstPx: Infinity}); return groups.get(k); };
    const firstDeep = P.elements.findIndex(e => e.path && e.path !== `slides.${si}` && !e.path.includes('design.background')); const isBg = (e, i) => e.path?.includes('design.background') || (e.path === `slides.${si}` && (firstDeep < 0 || i < firstDeep));
    P.elements.forEach((e, i) => { if (isBg(e, i)) return; if (e.path === `slides.${si}` && Number.isFinite(e.x) && Number.isFinite(e.w)) { const c = {x: e.x + e.w / 2, y: e.y + e.h / 2}; const it = items.filter(i => inside(c, i.frame ?? i.box)).sort((x, y) => x.box.w * x.box.h - y.box.w * y.box.h)[0]; if (it) { const G = g(it.path); G.pv.push(e); G.firstPv = Math.min(G.firstPv, i); return; } } if (e.path?.endsWith('.design.background') || (e.path === `slides.${si}` && e.tag === 'rect' && e.x === 0 && e.y === 0 && e.w === pvb[2])) return; const k = keyOfPreview(e.path); const G = g(k); G.pv.push(e); G.firstPv = Math.min(G.firstPv, i); });
    X.shapes.forEach(s => { const k = keyOfShape(s); if (k === 'unmapped') stats.shapesUnmapped++; else stats.shapesMapped++; const G = g(k); G.px.push(s); G.firstPx = Math.min(G.firstPx, s.order); });
    // (3) background
    const bgEls = P.elements.filter(isBg); const pbg = bgEls.find(e => e.kind === 'image') ?? bgEls.find(e => String(e.fill ?? '').startsWith('url(')) ?? bgEls[0];
    const pbgKind = pbg ? (pbg.kind === 'image' ? 'image' : /^url\(/.test(pbg.fill ?? '') ? 'gradient-or-pattern' : 'solid') : P.elements.some(e => e.path?.includes('design.background.image')) ? 'image' : 'none';
    const xbg = X.bg; const xbgKind = !xbg ? 'none' : xbg.kind === 'solid' ? 'solid' : xbg.kind === 'blipFill' ? 'image' : xbg.kind === 'gradFill' || xbg.kind === 'pattFill' ? 'gradient-or-pattern' : xbg.kind;
    if (pbgKind !== xbgKind) add('fills', 'fail', `background kind ${pbgKind} vs ${xbgKind}`, `slide ${si}`);
    else if (pbgKind === 'solid' && hex(pbg.fill) !== xbg.rgb) add('fills', 'fail', `background color ${hex(pbg.fill)} vs ${xbg.rgb}`, `slide ${si}`);
    // Per element group
    for (const [key, G] of groups) {
      if (key === 'unmapped') { for (const s of G.px) add('mapping', 'near', `pptx shape unmapped (${s.kind}${s.name ? ':' + s.name.replace(/\d+/g, '#') : ''})`, key); continue; }
      if (!G.px.length && G.pv.some(e => e.kind !== 'text' || normText(e.text))) { const kinds = uniq(G.pv.map(e => e.kind)); add('mapping', 'fail', `preview element group has no PPTX shape (${kinds.join('+')})`, key); continue; }
      if (!G.pv.length) { add('mapping', 'fail', `PPTX shape(s) with no preview element (${uniq(G.px.map(s => s.kind)).join('+')})`, key); continue; }
      const isChart = G.px.some(s => s.chart), isTable = G.px.some(s => s.table);
      // (2) text
      const pvLines = G.pv.filter(e => e.kind === 'text' && normText(e.text) && e.a['aria-hidden'] !== 'true'); const pvMarkers = G.pv.filter(e => e.kind === 'text' && e.a['aria-hidden'] === 'true' && normText(e.text));
      const pxParas = G.px.flatMap(s => (s.paragraphs ?? []).map((p, pi) => ({...p, shape: s, single: (s.paragraphs.length === 1)}))).filter(p => normText(p.text));
      stats.textLines += pvLines.length;
      if (pvMarkers.length) { const xb = pxParas.filter(p => p.bullet); const pm = pvMarkers.map(m => normText(m.text)).sort().join(''), xm = xb.map(p => p.bullet === '#auto' ? '#' : p.bullet).sort().join('');
        if (pm !== xm) add('text', 'fail', `list markers differ`, key, `${pvMarkers.length} preview [${pm.slice(0, 8)}] vs ${xb.length} pptx [${xm.slice(0, 8)}]`);
        for (const m of pvMarkers) { const para = xb.find(p => p.single && p.shape.box && Math.abs(p.shape.box.y + ((p.runs[0]?.sizePt ?? 0) / PX_PT) - m.y) < 1); if (!para) continue; const bx = para.shape.box.x + para.marL + para.indent; const d = r3(Math.abs(bx - m.x) * PX_PT); stats.geomMaxDeltaPt = Math.max(stats.geomMaxDeltaPt, d); if (d > TOL.geomPt) add('geometry', sev(d), `list marker x delta ${bucket(d)}pt`, key, d); } }
      if (isChart) {
        const ch = G.px.find(s => s.chart).chart; const strs = new Set(ch.strings.map(normText));
        const allStr = [...strs].join(''); const wrapped = pvLines.filter(l => !strs.has(normText(l.text)) && allStr.includes(normText(l.text))); if (wrapped.length) add('text', 'near', 'chart label wrapped/split in preview (native chart lays out its own labels)', key, wrapped.map(m => m.text).slice(0, 4).join(' | '));
        const missing = pvLines.filter(l => !wrapped.includes(l)).filter(l => !strs.has(normText(l.text)) && !/^[-\d.,%$€£\s]+$/.test(l.text) && !pxParas.some(p => normText(p.text) === normText(l.text)));
        if (missing.length) add('text', 'fail', `chart preview text not in native chart cache`, key, missing.map(m => m.text).slice(0, 4).join(' | '));
        const pvFams = uniq(pvLines.flatMap(l => l.runs.map(r => r.family))); const chFams = ch.typefaces;
        if (!chFams.length) add('text', 'fail', 'native chart has no explicit typeface (inherits theme/Office default)', key);
        else for (const f of pvFams) if (!chFams.includes(f)) add('text', 'fail', `chart font ${f} (preview) not in chart XML [${chFams.join('|')}]`, key);
        const pvSizes = uniq(pvLines.flatMap(l => l.runs.map(r => r.sizePt))); if (ch.sizes.length && pvSizes.some(s => !ch.sizes.some(c => Math.abs(c - s) <= TOL.sizePt))) add('text', 'near', `chart text sizes preview [${pvSizes}] vs chart [${ch.sizes}]`, key);
        const pvColors = uniq(G.pv.filter(e => e.kind === 'shape' && e.tag !== 'line' && e.fill && e.fill !== 'none').map(e => hex(e.fill)));
        const extra = ch.colors.filter(c => !pvColors.includes(c)); if (extra.length) add('fills', 'fail', `chart series colors not in preview (${extra.length})`, key);
      } else {
        const used = new Set();
        for (const l of pvLines) {
          const idx = pxParas.findIndex((p, i) => !used.has(i) && normText(p.text) === normText(l.text));
          if (idx < 0) { const joined = normText(pxParas.map(p => p.text).join(' ')); add('text', joined.includes(normText(l.text)) ? 'near' : 'fail', joined.includes(normText(l.text)) ? 'line segmentation differs (preview line is part of a PPTX paragraph)' : 'preview text line missing in PPTX', key, l.text); continue; }
          used.add(idx); stats.textLinesMatched++; const p = pxParas[idx];
          // run segmentation
          const pvRuns = l.runs, xr = p.runs.filter(r => r.text.length); stats.runs += pvRuns.length;
          if (pvRuns.length !== xr.length) add('text', 'near', `run segmentation ${pvRuns.length} preview vs ${xr.length} pptx`, key);
          // per-character style comparison
          const pvChars = pvRuns.flatMap(r => [...r.text].map(c => ({c, r}))), xChars = xr.flatMap(r => [...r.text].map(c => ({c, r})));
          const seen = new Set();
          for (let ci = 0; ci < Math.min(pvChars.length, xChars.length); ci++) {
            const a = pvChars[ci].r, b = xChars[ci].r; if (seen.has(a) && seen.has(b)) continue; seen.add(a); seen.add(b);
            const slot = scriptOf(pvChars[ci].c === ' ' ? a.text : pvChars[ci].c); const xf = b[slot] ?? b.latin ?? `+theme(${slot})`;
            chosenFamilies.add(a.family);
            if (xf !== a.family) add('text', 'fail', `font family (${slot} slot) ${a.family} vs ${xf}`, key, a.text);
            if (b.sizePt == null) add('text', 'fail', 'run size inherited (no sz)', key); else { const d = Math.abs(b.sizePt - a.sizePt); if (d > TOL.sizePt) add('text', d <= TOL.sizeNearPt ? 'near' : 'fail', `font size ${a.sizePt}pt vs ${b.sizePt}pt`, key); }
            if (a.bold !== b.bold) add('text', 'fail', `bold ${a.bold} vs ${b.bold}`, key);
            if (a.italic !== b.italic) add('text', 'fail', `italic ${a.italic} vs ${b.italic}`, key);
            const bc = b.fill?.rgb ?? null; if (b.fill?.via === 'srgb') stats.srgbLiteral++; else if (b.fill?.via?.startsWith('scheme')) stats.schemeClr++;
            if (a.color !== bc) add('text', 'fail', `text color ${a.color} vs ${bc ?? 'inherited'}${b.fill?.via?.startsWith('scheme') ? ' (' + b.fill.via + ')' : ''}`, key, a.text);
          }
          // alignment + (1) geometry of the text line: anchor point and baseline
          const pvAlign = {start: 'l', middle: 'ctr', end: 'r'}[l.anchor];
          if (pvAlign !== p.algn) add('text', 'fail', `alignment ${pvAlign} (preview) vs ${p.algn} (pptx)`, key, l.text);
          if (p.single && p.shape.box && !isTable) {
            // Compare the rendered line extent, not the raw anchor: a line anchored at its left edge in the
            // preview and centered in its PPTX box lands at the same place when the gap is half the line width.
            const b = p.shape.box; const w = pvRuns.reduce((sum, r) => sum + measureText(r.text, r.sizePt / PX_PT), 0);
            const pvLeft = l.anchor === 'middle' ? l.x - w / 2 : l.anchor === 'end' ? l.x - w : l.x;
            const pxLeft = p.algn === 'ctr' ? b.x + b.w / 2 - w / 2 : p.algn === 'r' ? b.x + b.w - w : b.x + p.marL;
            const size = (xr[0]?.sizePt ?? 0) / PX_PT; const baseline = b.y + size;
            const dx = r3(Math.abs(pxLeft - pvLeft) * PX_PT), dy = r3(Math.abs(baseline - l.y) * PX_PT); const d = Math.max(dx, dy);
            stats.geomMaxDeltaPt = Math.max(stats.geomMaxDeltaPt, d);
            if (d > TOL.geomPt) add('geometry', sev(d), `text line ${dx > TOL.geomPt ? 'anchor-x' : ''}${dx > TOL.geomPt && dy > TOL.geomPt ? '+' : ''}${dy > TOL.geomPt ? 'baseline-y' : ''} delta ${bucket(d)}pt`, key, `dx ${dx} dy ${dy} ${JSON.stringify(l.text.slice(0, 30))}`);
          }
        }
        const extra = pxParas.filter((p, i) => !used.has(i) && !pvLines.some(l => normText(p.text).includes(normText(l.text))));
        if (extra.length) add('text', 'fail', `PPTX text not in preview`, key, extra.map(p => p.text).slice(0, 3).join(' | '));
      }
      // (1) geometry of non-text frames (charts, tables, pictures, cards)
      for (const s of G.px.filter(s => s.box && (s.chart || s.table || s.image || s.name.startsWith('OPF card')))) {
        const it = items.find(i => i.path === key); if (!it) continue;
        let ref = s.name.startsWith('OPF card') ? it.frame : s.image ? (G.pv.find(e => e.kind === 'image') ?? it.box) : it.box; if (!ref) continue;
        if (s.image && ref.intrinsic && /meet/.test(ref.par)) { const k = Math.min(ref.w / ref.intrinsic.w, ref.h / ref.intrinsic.h), w = ref.intrinsic.w * k, h = ref.intrinsic.h * k; ref = {x: ref.x + (ref.w - w) / 2, y: ref.y + (ref.h - h) / 2, w, h}; }
        const d = geomDelta(s.box, ref); stats.geomMaxDeltaPt = Math.max(stats.geomMaxDeltaPt, d);
        if (d > TOL.geomPt) add('geometry', sev(d), `${s.chart ? 'chart' : s.table ? 'table' : s.image ? 'picture' : 'card'} frame delta ${bucket(d)}pt`, key, `${JSON.stringify(Object.fromEntries(Object.entries(s.box).map(([k, v]) => [k, r3(v)])))} vs ${JSON.stringify(Object.fromEntries(Object.entries(ref).filter(([k]) => 'xywh'.includes(k)).map(([k, v]) => [k, r3(v)])))}`);
      }
      // (3) fills & images
      if (!isChart) {
        const pvFills = uniq(G.pv.filter(e => e.kind === 'shape' && e.tag !== 'line' && e.fill && e.fill !== 'none' && !/^url/.test(e.fill)).map(e => hex(e.fill)));
        const pxFills = uniq(G.px.flatMap(s => [s.fill?.kind === 'solid' ? s.fill.rgb : null, ...(s.cellFills ?? [])]).filter(Boolean));
        const onlyPv = pvFills.filter(c => !pxFills.includes(c)), onlyPx = pxFills.filter(c => !pvFills.includes(c));
        if (onlyPv.length) add('fills', 'fail', `preview fill color(s) absent in PPTX${isTable ? ' [table]' : ''}`, key, `${onlyPv.join(',')} not in [${pxFills.join(',')}]`);
        if (onlyPx.length) add('fills', 'fail', `PPTX fill color(s) absent in preview${isTable ? ' [table]' : ''}`, key, `${onlyPx.join(',')} not in [${pvFills.join(',')}]`);
      }
      const pvImgs = G.pv.filter(e => e.kind === 'image').map(e => e.hash), pxImgs = G.px.filter(s => s.image).map(s => s.image.hash);
      if (pvImgs.length !== pxImgs.length) add('fills', 'fail', `image count ${pvImgs.length} preview vs ${pxImgs.length} pptx`, key);
      else if (pvImgs.some(h => !pxImgs.includes(h))) add('fills', 'near', 'image bytes differ (re-encoded/cropped in PPTX)', key);
    }
    // (4) z-order: order of mapped groups
    const both = [...groups.entries()].filter(([k, G]) => k !== 'unmapped' && G.pv.length && G.px.length);
    const byPv = [...both].sort((a, b) => a[1].firstPv - b[1].firstPv).map(x => x[0]), byPx = [...both].sort((a, b) => a[1].firstPx - b[1].firstPx).map(x => x[0]);
    let inv = 0; for (let i = 0; i < byPv.length; i++) for (let j = i + 1; j < byPv.length; j++) if (byPx.indexOf(byPv[i]) > byPx.indexOf(byPv[j])) inv++;
    if (inv) add('zOrder', 'fail', `z-order inversions between element groups (${inv})`, `slide ${si}`);
  }
  // Font resolution for every family the preview actually uses
  for (const f of chosenFamilies) if (f) fontRes[f] = resolveFamily(f);
  for (const [f, r] of Object.entries(fontRes)) if (r.status === 'visual-substitute' || r.status === 'missing') add('fontResolution', 'fail', `preview font ${r.status}: ${f}${r.resolved ? ' -> ' + r.resolved : ''}`, f);

  // (6) package typeface inventory
  const invt = inventory(files); const foreign = uniq(invt.typefaces.filter(t => t.typeface && !t.typeface.startsWith('+') && !chosenFamilies.has(t.typeface)).map(t => `${t.typeface}@${t.part.replace(/\d+/g, 'N')}:${t.tag}`));
  const foreignApp = invt.appFonts.filter(f => /^[A-Z][\w ]+$/.test(f) && !chosenFamilies.has(f) && /Arial|Calibri|Aptos|Cambria|Times|Georgia|Consolas|Courier|Roboto|Segoe|Yu |Meiryo|Microsoft|Noto|Nirmala|MS /.test(f));
  for (const f of foreign) add('typefaces', 'fail', `foreign typeface ${f.replace(/@.*/, '')} in ${f.replace(/^[^@]*@/, '')}`);
  for (const f of foreignApp) add('typefaces', 'fail', `foreign font in app.xml: ${f}`);
  const emptySlots = invt.typefaces.filter(t => t.typeface === '').length;
  // theme fonts & colors (part of "perfect PPTX output")
  const d0 = resolved.slides[0].design;
  if (theme.major.latin !== firstFamily(d0.fonts?.heading)) add('theme', 'fail', `theme major latin ${theme.major.latin} vs heading ${firstFamily(d0.fonts?.heading)}`);
  if (theme.minor.latin !== firstFamily(d0.fonts?.body)) add('theme', 'fail', `theme minor latin ${theme.minor.latin} vs body ${firstFamily(d0.fonts?.body)}`);
  const cs = d0.colorScheme ?? {}; const SLOT = {dark1: 'dk1', light1: 'lt1', dark2: 'dk2', light2: 'lt2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hyperlink: 'hlink', followedHyperlink: 'folHlink'};
  const slotMiss = Object.entries(SLOT).filter(([k, s]) => typeof cs[k] === 'string' && hex(cs[k]) !== theme.clr[s]).map(([k]) => k);
  if (slotMiss.length) add('theme', 'fail', `theme clrScheme differs from document color scheme (${slotMiss.length} slots)`);

  // (7) re-import round trip
  const idiag = []; let rt;
  try { rt = await fromPptx(bytes, {onDiagnostic: d => idiag.push({code: d.code, path: d.path})}); } catch (e) { add('reimport', 'fail', `fromPptx threw ${e.code ?? e.name}`); }
  if (rt) {
    const ids = {'design.colorScheme': d => d.design?.colorScheme, 'design.fontScheme': d => d.design?.fontScheme, 'design.theme': d => d.design?.theme, 'design.background': d => JSON.stringify(d.design?.background), 'design.dimensions': d => JSON.stringify(d.design?.dimensions), language: d => d.language, narrative: d => d.narrative, tone: d => d.tone, audience: d => JSON.stringify(d.audience)};
    for (const [k, get] of Object.entries(ids)) { const a = get(doc), b = get(rt); if (a === undefined || a === 'undefined') continue; if (a !== b) { const diag = idiag.find(x => x.path?.includes(k.split('.').pop())); add('reimport', diag ? 'near' : 'fail', `${k} not preserved${diag ? ' (diagnostic ' + diag.code + ')' : ' (no diagnostic)'}`); } }
    doc.slides.forEach((s, i) => { const a = s.layout, b = rt.slides?.[i]?.layout; if (a && a !== b) { const diag = idiag.find(x => x.path?.startsWith(`slides.${i}`) && /layout/i.test(x.code + x.path)); add('reimport', diag ? 'near' : 'fail', `slide layout id not preserved${diag ? ' (diagnostic ' + diag.code + ')' : ' (no diagnostic)'}`, `slides.${i}`); } });
    if ((rt.slides?.length ?? 0) !== doc.slides.length) add('reimport', 'fail', `slide count ${doc.slides.length} -> ${rt.slides?.length}`);
  }
  // classify
  const CHECKS = ['geometry', 'text', 'fills', 'zOrder', 'slideSize', 'typefaces', 'reimport', 'fontResolution', 'theme', 'mapping'];
  const checks = Object.fromEntries(CHECKS.map(c => { const ds = diffs.filter(d => d.check === c); return [c, ds.some(d => d.status === 'fail') ? 'fail' : ds.length ? 'near' : 'pass']; }));
  const cls = Object.values(checks).includes('fail') ? 'mismatch' : Object.values(checks).includes('near') ? 'near' : 'perfect';
  const counted = {}; for (const d of diffs) { const k = `${d.check}|${d.status}|${d.reason}`; counted[k] ??= {check: d.check, status: d.status, reason: d.reason, count: 0, where: [], samples: []}; counted[k].count++; if (d.where && counted[k].where.length < 3 && !counted[k].where.includes(d.where)) counted[k].where.push(d.where); if (d.sample && counted[k].samples.length < 2) counted[k].samples.push(d.sample); }
  const top = Object.values(counted).sort((a, b) => (a.status === 'fail' ? 0 : 1) - (b.status === 'fail' ? 0 : 1) || b.count - a.count);
  return {class: cls, checks, stats: {...stats, geomMaxDeltaPt: r3(stats.geomMaxDeltaPt)}, fontResolution: fontRes, typefaces: {distinct: uniq(invt.typefaces.map(t => t.typeface)), foreign, scriptSupplements: uniq(invt.scriptSupplements).length, scriptSupplementFaces: uniq(invt.scriptSupplements.map(s => s.split('=')[1])), emptySlots, appFonts: invt.appFonts}, previewDiagnostics: uniq(pv.pdiag), exportDiagnostics: uniq(ediag), reimportDiagnostics: uniq(idiag.map(d => d.code)), diffs: top.slice(0, 25)};
}

const results = []; const t0 = Date.now(); let n = 0;
const perDim = {};
for (const s of snippets) {
  perDim[s.dimension] = (perDim[s.dimension] ?? 0) + 1; if (perDim[s.dimension] > LIMIT) continue;
  const base = {dimension: s.dimension, id: s.id, variant: s.variant};
  if (s.error) { results.push({...base, class: 'mismatch', fatal: 'gallery snippet builder threw', message: s.error, checks: {}, diffs: []}); continue; }
  try { results.push({...base, ...(await parity(s.snippet))}); }
  catch (e) { results.push({...base, class: 'mismatch', fatal: `harness error ${e.name}`, message: String(e.stack).slice(0, 400), checks: {}, diffs: []}); }
  if (++n % 50 === 0) console.error(`${n} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
const meta = {generatedBy: 'dimension-audit/parity/scripts/parity.mjs', generatedAt: new Date().toISOString(), node: process.version, prefix: PFX,
  heads: {opf: head(CORE), 'opf-render': head(RENDER), 'opf-pptx': head(PPTX), 'pptx-gallery': head(GALLERY)},
  tolerances: TOL, previewMode: 'engine default measurement (no host registry) for geometry/text; office pack + visual substitution registry for font resolution',
  exportMode: 'toPptx default options (no registry)'};
const OUT = process.env.OUT ?? path.join(ROOT, 'parity-results.json');
await writeFile(OUT, JSON.stringify({meta, results}, null, 1));
console.error(`wrote ${results.length} results to ${OUT} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
