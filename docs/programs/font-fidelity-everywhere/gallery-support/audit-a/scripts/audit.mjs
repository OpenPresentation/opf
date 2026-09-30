// Dimension audit A: layouts, content blocks, image treatments, backgrounds, headers & footers.
// Run: node --import ./register.mjs audit.mjs   (read-only against all repos; writes only ../out and ../results.json)
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..');
const SRC = path.resolve(OUT, '../../sources');
const CORE = path.join(SRC, 'audit-A-opf');
const RENDER = path.join(SRC, 'audit-A-opf-render');
const PPTX = path.join(SRC, 'audit-A-opf-pptx');
const GALLERY = process.env.GALLERY_DIR ?? '<workspace>/pptx-gallery';
const ONLY = process.env.ONLY?.split(',');
const LIMIT = Number(process.env.LIMIT ?? Infinity);

const core = await import('@openpresentation/opf');
const { renderSvgDeck, resolvePresentation } = await import(pathToFileURL(path.join(RENDER, 'src/svg.js')));
const { loadOfficeFontRegistry } = await import(pathToFileURL(path.join(RENDER, 'src/fonts-node.js')));
const { toPptx, fromPptx } = await import(pathToFileURL(path.join(PPTX, 'src/index.js')));
const preq = createRequire(path.join(PPTX, 'package.json'));
const { unzipSync } = preq('fflate');
const { probeTreatmentImages, declaredImages } = await import(pathToFileURL(path.join(HERE, 'image-treatment.mjs')));

// 1. Bundle the gallery's own snippet builders (same approach as core scripts/test-gallery-snippets.mjs).
const creq = createRequire(path.join(CORE, 'packages/javascript/package.json'));
const { build } = createRequire(creq.resolve('tsup'))('esbuild');
await mkdir(path.join(OUT, 'out'), { recursive: true });
const bundle = path.join(OUT, 'out/snippets.mjs');
await build({
  // pptx-gallery#44 moved buildImageTreatmentOpfSnippet to lib/image-treatment-snippets.ts, and pptx-gallery#48 routes the editor
  // through buildCatalogItemOpfSnippet (lib/opf-item-snippets.ts); re-export all three.
  stdin: { contents: "export * from './lib/opf-snippets.ts';\nexport { buildImageTreatmentOpfSnippet } from './lib/image-treatment-snippets.ts';\nexport { buildCatalogItemOpfSnippet } from './lib/opf-item-snippets.ts';\n", resolveDir: GALLERY, sourcefile: 'audit-a-snippets-entry.ts', loader: 'ts' }, outfile: bundle, bundle: true, platform: 'node', format: 'esm',
  packages: 'external', tsconfig: path.join(GALLERY, 'tsconfig.json'), logLevel: 'error',
  plugins: [{ name: 'core-pkg-json', setup(b) { b.onResolve({ filter: /^@openpresentation\/opf\/package\.json$/ }, () => ({ path: path.join(CORE, 'packages/javascript/package.json') })); } }],
});
const snippets = await import(pathToFileURL(bundle));
const data = async (n) => JSON.parse(await readFile(path.join(GALLERY, `data/${n}.json`), 'utf8'));
const sampleImage = JSON.parse(await readFile(path.join(GALLERY, 'data/layout-example-image.json'), 'utf8'));

const fonts = await loadOfficeFontRegistry();
// Primary mode: engine default measurement (no host font registry). The Office font registry used by core's
// ecosystem tests is probed separately per value (checks.fontRegistry): the default Aptos scheme is not in it.
const OPTS = {};
const REG = { textMeasurement: fonts.textMeasurement };
function fontProbe(doc) { try { renderSvgDeck(doc, REG); return { pass: true }; } catch (e) { return { pass: false, ...errInfo(e) }; } }
const PPTX_OPTS = { ...OPTS, seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z' };

// ---------- helpers ----------
const clone = (x) => structuredClone(x);
const uniq = (a) => [...new Set(a)];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const errInfo = (e) => ({ code: e?.code ?? null, message: String(e?.message ?? e).slice(0, 400) });
const coreLayoutIds = new Set(core.layouts.map((l) => l.id));
const ids = (list) => new Set(list.map((r) => r.id));
const coreSets = { colorScheme: ids(core.colorSchemes), fontScheme: ids(core.fontSchemes), narrative: ids(core.narratives), tone: ids(core.tones) };
const inlineIds = (doc, kind) => new Set((doc.catalogs?.[kind]?.records ?? []).map((r) => r.id));
const withAssets = (doc) => ({ ...clone(doc), assets: { hero: { src: sampleImage, alt: 'hero' }, cover: { src: sampleImage, alt: 'cover' }, logo: { src: sampleImage, alt: 'logo' } } });

function validate(doc) {
  const r = core.validatePresentation(doc);
  return { pass: r.valid, errors: r.valid ? [] : (r.errors ?? []).slice(0, 5).map((e) => e.message ?? JSON.stringify(e)) };
}
function lint(doc) {
  try { const r = core.lintPresentation(doc); const d = r?.diagnostics ?? r?.issues ?? r ?? []; return Array.isArray(d) ? uniq(d.map((x) => x.code ?? x.rule ?? 'lint')) : []; } catch (e) { return [`lint-threw:${e.message}`]; }
}
function render(doc, extra = {}) {
  const diagnostics = [];
  try {
    const svgs = renderSvgDeck(doc, { ...OPTS, ...extra, onDiagnostic: (d) => diagnostics.push(d) });
    const resolved = resolvePresentation(doc, OPTS);
    return { ok: true, svgs, resolvedLayouts: resolved.slides.map((s) => s.layout?.id ?? null), ...(extra.trace ? { resolved } : {}), diagnostics: diagnostics.map((d) => ({ code: d.code, path: d.path, reason: d.reason })) };
  } catch (e) { return { ok: false, error: errInfo(e), diagnostics }; }
}
async function exportPptx(doc) {
  const diagnostics = [];
  try {
    const bytes = await toPptx(doc, { ...PPTX_OPTS, onDiagnostic: (d) => diagnostics.push(d) });
    const files = unzipSync(bytes);
    const names = Object.keys(files);
    const opc = ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels'].every((n) => names.includes(n));
    const dec = (n) => new TextDecoder().decode(files[n]);
    const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/))).map(dec);
    const layoutsXml = names.filter((n) => /^ppt\/(slideLayouts|slideMasters)\/[^/]+\.xml$/.test(n)).map(dec).join('\n');
    return { ok: true, bytes, size: bytes.length, opc, slideCount: slides.length, slides, layoutsXml, names, diagnostics: diagnostics.map((d) => ({ code: d.code, path: d.path })) };
  } catch (e) { return { ok: false, error: errInfo(e), diagnostics }; }
}
async function reimport(bytes) {
  const diagnostics = [];
  try { const doc = await fromPptx(bytes, { onDiagnostic: (d) => diagnostics.push(d) }); return { ok: true, doc, diagnostics: diagnostics.map((d) => ({ code: d.code, path: d.path })) }; }
  catch (e) { return { ok: false, error: errInfo(e), diagnostics }; }
}
const { geometry, placementSignature, alignmentAgreement } = await import(pathToFileURL(path.join(HERE, 'placement.mjs')));
const count = (xml, re) => (xml.match(re) ?? []).length;
const codes = (d) => uniq((d ?? []).map((x) => x.code));
const svgHas = (svg, s) => svg.includes(esc(s)) || svg.includes(s);
// Asset references ("asset:<id>") that the snippet does not define under assets. The published snippets became self-contained
// in pptx-gallery#43/#44/#47, so this is measured per snippet instead of assumed.
const missingAssets = (doc) => uniq([...JSON.stringify(doc).matchAll(/"asset:([\w-]+)"/g)].map((m) => m[1])).filter((id) => !doc.assets?.[id]);

// Evidence index (check 6): native PowerPoint evidence directories + compatibility matrix.
const evidence = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (/\.(json|md)$/.test(e.name) && (await stat(p)).size < 4e6) evidence.push({ file: path.relative(CORE, p).replace(/\\/g, '/'), text: await readFile(p, 'utf8') });
  }
}
await walk(path.join(CORE, 'docs/evidence'));
evidence.push({ file: 'docs/compatibility-matrix.md', text: await readFile(path.join(CORE, 'docs/compatibility-matrix.md'), 'utf8') });
const isNative = (f) => /native|powerpoint|windows-|office/i.test(f);
const evidenceFor = (re) => uniq(evidence.filter((e) => re.test(e.text)).map((e) => e.file.split('/').slice(0, 3).join('/'))).sort();
const nativeEvidence = (re) => { const all = evidenceFor(re); return { native: all.filter(isNative), other: all.filter((f) => !isNative(f)).length }; };

function classify(r) {
  const c = r.checks, reasons = [...r.reasons];
  if (!c.schema.pass) return { class: 'broken', reasons: ['schema invalid', ...reasons] };
  if (!c.render.pass) return { class: 'broken', reasons: [`preview threw ${c.render.error?.code}`, ...reasons] };
  if (!c.export.pass) return { class: 'broken', reasons: [`export threw ${c.export.error?.code}`, ...reasons] };
  if (c.render.effect === false && c.export.native === false) return { class: 'schema-only', reasons: ['no visible effect in preview or export', ...reasons] };
  const all = c.catalog.pass && c.render.effect !== false && c.export.opc && c.export.native !== false && c.reimport.pass !== false;
  return { class: all && reasons.length === 0 ? 'works' : 'partial', reasons };
}
function baseChecks(doc, base, extra = {}) { return { doc, base, ...extra }; }

async function measure(doc, baseDoc) {
  const schema = validate(doc);
  const r = schema.pass ? render(doc) : { ok: false, error: { code: 'skipped-invalid' } };
  const rb = baseDoc ? render(baseDoc) : null;
  const x = schema.pass ? await exportPptx(doc) : { ok: false, error: { code: 'skipped-invalid' } };
  const xb = baseDoc ? await exportPptx(baseDoc) : null;
  const im = x.ok ? await reimport(x.bytes) : { ok: false, error: { code: 'skipped' } };
  return { schema, lint: schema.pass ? lint(doc) : [], r, rb, x, xb, im, font: schema.pass ? fontProbe(doc) : null };
}
function commonChecks(m) {
  const { schema, r, rb, x, xb, im } = m;
  const renderEffect = r.ok && rb?.ok ? r.svgs.join('') !== rb.svgs.join('') : null;
  const exportDiff = x.ok && xb?.ok ? x.slides.join('') + x.layoutsXml !== xb.slides.join('') + xb.layoutsXml : null;
  return {
    schema: { pass: schema.pass, errors: schema.errors, lint: m.lint },
    render: { pass: r.ok, error: r.error ?? null, diagnostics: codes(r.diagnostics), effect: renderEffect, resolvedLayouts: r.resolvedLayouts },
    export: { pass: x.ok, error: x.error ?? null, opc: !!x.opc, bytes: x.size ?? null, slides: x.slideCount ?? null, diagnostics: codes(x.diagnostics), differsFromBaseline: exportDiff, hasPhf: x.ok ? x.slides.some((s) => s.includes('<p:hf')) || x.layoutsXml.includes('<p:hf') : null },
    reimport: { pass: im.ok, error: im.error ?? null, diagnostics: codes(im.diagnostics) },
    fontRegistry: m.font,
  };
}
const results = [];
const dims = {};
const want = (d) => !ONLY || ONLY.includes(d);

// ---------- BACKGROUNDS ----------
if (want('backgrounds')) {
  const items = (await data('backgrounds')).items.slice(0, LIMIT);
  const shapes = {};
  for (const item of items) shapes[item.slug] = JSON.stringify(JSON.parse(snippets.buildOpfSnippet('backgrounds', item.slug)).design.background);
  for (const item of items) {
    const doc = JSON.parse(snippets.buildOpfSnippet('backgrounds', item.slug));
    const bg = doc.design.background, type = bg.type;
    const variants = type === 'image' ? { published: doc, withAssets: withAssets(doc) } : { published: doc };
    const out = { dimension: 'backgrounds', id: item.slug, opfMapping: bg, variants: {} };
    for (const [vn, vdoc] of Object.entries(variants)) {
      const base = clone(vdoc); delete base.design.background;
      const m = await measure(vdoc, base), checks = commonChecks(m), reasons = [];
      const fillTag = { solid: 'a:solidFill', gradient: 'a:gradFill', pattern: 'a:pattFill', image: 'a:blipFill' }[type];
      const bgXml = m.x.ok ? [...m.x.slides[0].matchAll(/<p:bg>[\s\S]*?<\/p:bg>/g), ...m.x.layoutsXml.matchAll(/<p:bg>[\s\S]*?<\/p:bg>/g)].map((a) => a[0]).join('') : '';
      checks.catalog = { pass: true, note: 'no OPF catalog kind for backgrounds; gallery slug maps to inline design.background' };
      checks.export.native = m.x.ok ? bgXml.includes(`<${fillTag}`) && (type !== 'pattern' || bgXml.includes(`prst="${bg.pattern?.preset}"`)) : null;
      checks.export.nativeDetail = bgXml.slice(0, 300);
      const imp = m.im.ok ? (m.im.doc.slides?.[0]?.design?.background ?? m.im.doc.design?.background) : null;
      checks.reimport.retained = imp?.type === type; checks.reimport.imported = imp ?? null;
      checks.reimport.pass = m.im.ok && (checks.reimport.retained || checks.reimport.diagnostics.length > 0);
      checks.evidence = nativeEvidence(new RegExp(`"type"\\s*:\\s*"${type}"[\\s\\S]{0,40}|background[\\s\\S]{0,80}${type}`, 'i'));
      if (!checks.export.native) reasons.push(`export has no native <${fillTag}> background`);
      if (!checks.reimport.retained) reasons.push(`re-import does not return background type ${type}`);
      if (checks.render.diagnostics.length) reasons.push(`preview diagnostics: ${checks.render.diagnostics.join(',')}`);
      if (checks.export.diagnostics.length) reasons.push(`export diagnostics: ${checks.export.diagnostics.join(',')}`);
      const twins = Object.entries(shapes).filter(([s, v]) => s !== item.slug && v === shapes[item.slug]).map(([s]) => s);
      if (twins.length) reasons.push(`gallery slug collapses to the same OPF background as ${twins.join(', ')} (treatment identity not representable)`);
      if (vn === 'published') for (const id of missingAssets(doc)) reasons.push(`gallery snippet references asset:${id} without an assets entry`);
      out.variants[vn] = { checks, ...classify({ checks, reasons }) };
    }
    Object.assign(out, pick(out));
    results.push(out);
  }
}
function pick(out) { const v = out.variants.published; return { class: v.class, reasons: v.reasons, checks: v.checks, withAssetsClass: out.variants.withAssets?.class ?? null }; }

// ---------- IMAGE TREATMENTS ----------
// Owner default 2026-09-30: "works" for a treatment means the design output the gallery snippet emits (layout image, image blocks,
// image background, design.watermark, imageFill, ...) is written natively into the PPTX and re-imports (image-treatment.mjs).
if (want('image-treatments')) {
  const items = (await data('image-treatments')).items.slice(0, LIMIT);
  const bare = (doc) => { const d = clone(doc); delete d.name; delete d.description; delete d.tags; delete d.extras; return JSON.stringify(d); };
  const docs = Object.fromEntries(items.map((i) => [i.slug, JSON.parse(snippets.buildImageTreatmentOpfSnippet(i))]));
  const editorDocs = Object.fromEntries(items.map((i) => [i.slug, snippets.buildCatalogItemOpfSnippet('image-treatments', i.slug)]));
  const editorSame = uniq(items.map((i) => JSON.stringify(JSON.parse(editorDocs[i.slug]).design))).length === 1;
  for (const item of items) {
    const doc = docs[item.slug];
    const out = { dimension: 'image-treatments', id: item.slug, opfMapping: { design: doc.design ?? null, images: declaredImages(doc).map((i) => i.where) }, gallery: { opfSupport: item.opfSupport ?? null, opfGapNote: item.opfGapNote ?? null }, variants: {} };
    for (const [vn, vdoc] of Object.entries({ published: doc, withAssets: { ...withAssets(doc), assets: { ...withAssets(doc).assets, ...(doc.assets ?? {}) } } })) {
      // withAssets keeps the snippet's own assets and adds the sample raster for hero, cover and logo where the snippet has none.
      const base = clone(vdoc); if (base.design) { delete base.design.background; delete base.design.watermark; delete base.design.imageFill; }
      const m = await measure(vdoc, base), checks = commonChecks(m), reasons = [];
      checks.catalog = { pass: true, note: 'no OPF catalog kind; the treatment is the design output the snippet emits' };
      if (m.x.ok) {
        const traced = render(clone(vdoc), { trace: true });
        const probe = traced.ok ? probeTreatmentImages({ doc: vdoc, svgs: traced.svgs, files: unzipSync(m.x.bytes), imported: m.im.ok ? m.im.doc : null })
          : { native: false, expected: 0, declared: 0, found: 0, slides: [], reasons: [`traced preview threw ${traced.error?.code}`], reimport: { ok: false, missing: ['no traced preview'] } };
        checks.render.effect = probe.expected > 0;
        checks.export.native = probe.native;
        checks.export.nativeDetail = { previewImages: probe.expected, declaredImages: probe.declared, nativeMatched: probe.found, slides: probe.slides };
        reasons.push(...probe.reasons);
        checks.reimport.images = probe.reimport.images;
        checks.reimport.retained = probe.reimport.ok && probe.reimport.missing.length === 0;
        checks.reimport.pass = m.im.ok && checks.reimport.retained;
        for (const x of probe.reimport.missing) reasons.push(checks.reimport.diagnostics.length ? `${x} (diagnostics: ${checks.reimport.diagnostics.join(',')})` : `${x} (no diagnostic)`);
      } else { checks.export.native = null; checks.reimport.retained = false; checks.reimport.pass = false; }
      // A probe that did not run proves nothing: classify() lets native === null through, so it must carry a reason.
      if (checks.export.native === null) reasons.push(`image probe not run (export ${m.x.ok ? 'ok' : 'failed'})`);
      checks.evidence = nativeEvidence(/imageFill|native-picture|OPF watermark|alphaModFix/);
      if (checks.render.diagnostics.length) reasons.push(`preview diagnostics: ${checks.render.diagnostics.join(',')}`);
      if (checks.export.diagnostics.length) reasons.push(`export diagnostics: ${checks.export.diagnostics.join(',')}`);
      const twins = items.filter((i) => i.slug !== item.slug && bare(docs[i.slug]) === bare(doc)).map((i) => i.slug);
      if (twins.length) reasons.push(`the snippet is the same OPF document as ${twins.join(', ')}`);
      if (vn === 'published') for (const id of missingAssets(doc)) reasons.push(`gallery snippet references asset:${id} without an assets entry`);
      out.variants[vn] = { checks, ...classify({ checks, reasons }) };
    }
    out.editorPathSlugAgnostic = editorSame;
    out.editorMatchesSnippet = JSON.stringify(JSON.parse(editorDocs[item.slug])) === JSON.stringify(doc);
    Object.assign(out, pick(out));
    results.push(out);
  }
}

// ---------- HEADERS & FOOTERS ----------
if (want('headers-footers')) {
  const items = (await data('headers-footers')).items.slice(0, LIMIT);
  // The editor path is the gallery's per-item builder (pptx-gallery#48), not the slug-only buildOpfSnippet.
  const editorDocs = Object.fromEntries(items.map((i) => [i.slug, snippets.buildCatalogItemOpfSnippet('headers-footers', i.slug)]));
  const editorSame = uniq(items.map((i) => JSON.stringify(JSON.parse(editorDocs[i.slug]).design))).length === 1;
  const designs = {};
  for (const item of items) designs[item.slug] = JSON.stringify(JSON.parse(snippets.buildHeaderFooterOpfSnippet(item)).design ?? null);
  for (const item of items) {
    const doc = JSON.parse(snippets.buildHeaderFooterOpfSnippet(item));
    const cfg = item.config, dropped = [];
    // Measured against the snippet (pptx-gallery#47 expresses these settings), not assumed from the pre-#47 builder.
    const slots = ['header', 'footer'].flatMap((k) => Object.values(doc.design?.[k] ?? {}));
    const titleHides = doc.slides?.[0]?.design?.footer === false && (!doc.design?.header || doc.slides[0].design.header === false);
    if (cfg.hideOnTitleSlide && !titleHides) dropped.push('hideOnTitleSlide (no slide-level header/footer:false emitted)');
    if (cfg.slideNumbers && cfg.slideNumberFormat && cfg.slideNumberFormat !== '{current}' && !slots.some((v) => v.slideNumberFormat === cfg.slideNumberFormat)) dropped.push(`slideNumberFormat "${cfg.slideNumberFormat}"`);
    if (cfg.dateFormat && !slots.some((v) => v.dateFormat === cfg.dateFormat)) dropped.push(`dateFormat "${cfg.dateFormat}" (only date:true emitted)`);
    if (cfg.legalLine && !slots.some((v) => v.text === cfg.legalLine)) dropped.push('legalLine (not emitted as furniture text)');
    if (cfg.classificationLine && !slots.some((v) => v.text === cfg.classificationLine)) dropped.push('classificationLine (not emitted as furniture text)');
    if (slots.some((v) => v.date && v.slideNumber)) dropped.push('date and slideNumber merged into one footer.right slot');
    if (cfg.logoPosition === 'footer' && cfg.footerContent) dropped.push('footer logo and footerContent share footer.left');
    const out = { dimension: 'headers-footers', id: item.slug, opfMapping: doc.design ?? null, gallery: { opfStatus: item.opfStatus ?? null, opfGapNote: item.opfGapNote ?? null }, configDropped: dropped, variants: {} };
    const hasLogo = /asset:logo/.test(JSON.stringify(doc));
    for (const [vn, vdoc] of Object.entries(hasLogo ? { published: doc, withAssets: withAssets(doc) } : { published: doc })) {
      const base = clone(vdoc); if (base.design) { delete base.design.header; delete base.design.footer; if (!Object.keys(base.design).length) delete base.design; }
      const m = await measure(vdoc, base), checks = commonChecks(m), reasons = [];
      checks.catalog = { pass: true, note: 'no OPF catalog kind; pattern maps to design.header/footer furniture' };
      const texts = [], fixedDates = [], slotNames = [];
      for (const k of ['header', 'footer']) for (const [pos, v] of Object.entries(doc.design?.[k] ?? {})) { if (v.text) texts.push(v.text);
        // A fixed date is static content (only a current date, `date: true`, is a live field): its formatted text must be in the export.
        if (typeof v.date === 'string') { const f = v.dateFormat === undefined ? { text: v.date } : core.formatFurnitureDate(v.date, v.dateFormat); if ('text' in f) fixedDates.push(f.text); }
        slotNames.push(`${k}.${pos}:${Object.keys(v).join('+')}`); }
      // The slide the furniture is measured on: the first slide that does not switch it off (the gallery title slide hides it).
      const shownAt = Math.max(0, (doc.slides ?? []).findIndex((sl) => sl.design?.footer !== false && sl.design?.header !== false));
      const wantsNum = /"slideNumber":true/.test(JSON.stringify(doc.design ?? {})), wantsDate = /"date":true/.test(JSON.stringify(doc.design ?? {}));
      if (m.x.ok && m.xb?.ok) {
        const s = m.x.slides[shownAt], b = m.xb.slides[shownAt];
        const missingText = [...texts, ...fixedDates].filter((t) => !s.includes(esc(t)));
        const num = !wantsNum || /type="slidenum"/.test(s), date = !wantsDate || /type="datetime/.test(s) || /\d{4}|\d{1,2}\/\d{1,2}/.test(s.replace(b, ''));
        const logo = !hasLogo || count(s, /<p:pic>/g) > count(b, /<p:pic>/g);
        checks.export.native = slotNames.length === 0 ? false : missingText.length === 0 && num && date && (vn === 'published' || logo);
        checks.export.nativeDetail = { missingText, slideNumberField: /type="slidenum"/.test(s), dateField: /type="datetime/.test(s), logoPic: count(s, /<p:pic>/g) - count(b, /<p:pic>/g), furnitureTag: /OPF_FURNITURE/.test(s) || m.x.names.some((n) => /tags/.test(n)), shapesAdded: count(s, /<p:sp>/g) - count(b, /<p:sp>/g) };
        if (!num) reasons.push('slide number exported as static text run, not an a:fld type="slidenum" field (does not renumber in PowerPoint)');
        if (wantsDate && !/type="datetime/.test(s)) reasons.push('date requested but no native datetime field in export');
        if (missingText.length) reasons.push(`export missing furniture text: ${missingText.join(' | ')}`);
        if (hasLogo && vn === 'withAssets' && !logo) reasons.push('logo image not exported as picture');
      } else checks.export.native = null;
      if (m.r.ok && m.rb?.ok && checks.render.effect) {
        const svg = m.r.svgs[shownAt]; checks.render.textsVisible = texts.filter((t) => svgHas(svg, t)).length + '/' + texts.length;
      }
      const imp = m.im.ok ? m.im.doc : null, impStr = imp ? JSON.stringify(imp) : '';
      const retainedSlots = imp ? ['header', 'footer'].filter((k) => imp.design?.[k] || imp.slides?.some((sl) => sl.design?.[k])) : [];
      const wantSlots = ['header', 'footer'].filter((k) => doc.design?.[k]);
      checks.reimport.retained = wantSlots.length > 0 && wantSlots.every((k) => retainedSlots.includes(k)) && texts.every((t) => impStr.includes(t)) && (!wantsNum || impStr.includes('slideNumber'));
      checks.reimport.pass = m.im.ok && (checks.reimport.retained || checks.reimport.diagnostics.length > 0);
      checks.evidence = nativeEvidence(/OPF_FURNITURE|furniture/i);
      if (!slotNames.length) reasons.push('snippet emits no header/footer (config maps to nothing)');
      if (checks.render.effect === false) reasons.push('preview identical with and without header/footer');
      if (!checks.reimport.retained) reasons.push(checks.reimport.diagnostics.length ? `re-import loses furniture (diagnostics: ${checks.reimport.diagnostics.join(',')})` : 're-import loses furniture silently');
      if (checks.render.diagnostics.length) reasons.push(`preview diagnostics: ${checks.render.diagnostics.join(',')}`);
      if (checks.export.diagnostics.length) reasons.push(`export diagnostics: ${checks.export.diagnostics.join(',')}`);
      if (dropped.length) reasons.push(`gallery config not expressed in snippet: ${dropped.join('; ')}`);
      if (vn === 'published') for (const id of missingAssets(doc)) reasons.push(`gallery snippet references asset:${id} without an assets entry`);
      const twins = Object.entries(designs).filter(([s, v]) => s !== item.slug && v === designs[item.slug]).map(([s]) => s);
      if (twins.length) reasons.push(`identical OPF to ${twins.join(', ')}`);
      out.variants[vn] = { checks, ...classify({ checks, reasons }) };
    }
    out.editorPathSlugAgnostic = editorSame;
    out.editorMatchesSnippet = editorDocs[item.slug] === snippets.buildHeaderFooterOpfSnippet(item);
    Object.assign(out, pick(out));
    results.push(out);
  }
}

// ---------- CONTENT BLOCKS ----------
function expectedStrings(slide) {
  const s = [slide.title, slide.subtitle, slide.tag].filter(Boolean);
  const walkP = (p) => {
    if (!p) return;
    if (Array.isArray(p.items)) s.push(...p.items.map((i) => (typeof i === 'string' ? i : i.text)).filter((t) => typeof t === 'string'));
    if (typeof p.metric === 'string') s.push(p.metric);
    if (p.quote?.text) s.push(p.quote.text);
    if (p.timeline) s.push(...p.timeline.events.map((e) => e.what));
    if (p.table) s.push(...p.table.columns, ...p.table.rows.flat().filter((c) => typeof c === 'string'));
  };
  walkP(slide); for (const b of slide.blocks ?? []) walkP(b);
  return uniq(s.filter((t) => t && t.length > 2));
}
const kinds = (slide) => uniq([slide, ...(slide.blocks ?? [])].flatMap((p) => ['items', 'metric', 'quote', 'timeline', 'table', 'chart', 'image'].filter((k) => p[k] !== undefined)));
if (want('blocks')) {
  const items = (await data('blocks')).items.slice(0, LIMIT);
  const editorDocs = Object.fromEntries(items.map((i) => [i.slug, snippets.buildCatalogItemOpfSnippet('blocks', i.slug)]));
  const editorSame = uniq(items.map((i) => { const d = JSON.parse(editorDocs[i.slug]); delete d.name; delete d.tags; d.slides.forEach((s) => delete s.subtitle); return JSON.stringify(d); })).length === 1;
  for (const item of items) {
    let doc;
    const out = { dimension: 'blocks', id: item.slug, variants: {} };
    try { doc = snippets.buildContentBlockOpfObject(item); } catch (e) {
      out.variants.published = { checks: { schema: { pass: false, errors: [errInfo(e).message] } }, class: 'broken', reasons: ['gallery snippet builder threw: ' + errInfo(e).message] };
      Object.assign(out, pick(out)); results.push(out); continue;
    }
    out.opfMapping = { design: doc.design, layouts: doc.slides.map((s) => s.layout), kinds: doc.slides.map(kinds) };
    const m = await measure(doc, null), checks = commonChecks(m), reasons = [];
    const unresolved = [];
    const inl = inlineIds(doc, 'layouts');
    for (const s of doc.slides) if (s.layout && !coreLayoutIds.has(s.layout) && !inl.has(s.layout)) unresolved.push(`layout:${s.layout}`);
    for (const k of ['colorScheme', 'fontScheme']) { const v = doc.design?.[k]; if (typeof v === 'string' && !coreSets[k].has(v) && !inlineIds(doc, k + 's').has(v)) unresolved.push(`${k}:${v}`); }
    for (const k of ['narrative', 'tone']) { const v = doc[k]; if (typeof v === 'string' && !coreSets[k].has(v)) unresolved.push(`${k}:${v}`); }
    checks.catalog = { pass: unresolved.length === 0, unresolved, inlineLayouts: [...inl] };
    if (m.r.ok) {
      const mism = doc.slides.map((s, i) => (s.layout && m.r.resolvedLayouts[i] !== s.layout ? `${i}:${s.layout}->${m.r.resolvedLayouts[i]}` : null)).filter(Boolean);
      checks.render.layoutMismatch = mism;
      const miss = doc.slides.flatMap((s, i) => expectedStrings(s).filter((t) => !svgHas(m.r.svgs[i] ?? '', t)).map((t) => `${i}:${t}`));
      const total = doc.slides.reduce((n, s) => n + expectedStrings(s).length, 0);
      checks.render.missingText = miss.slice(0, 10); checks.render.effect = miss.length < total;
      if (miss.length) reasons.push(`preview missing ${miss.length} expected strings (e.g. ${miss[0]})`);
      if (mism.length) reasons.push(`preview resolved different layout: ${mism.join(', ')}`);
    }
    if (m.x.ok) {
      const miss = doc.slides.flatMap((s, i) => expectedStrings(s).filter((t) => !(m.x.slides[i] ?? '').includes(esc(t))).map((t) => `${i}:${t}`));
      const chartsWanted = doc.slides.filter((s) => kinds(s).includes('chart')).length, chartParts = m.x.names.filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)).length;
      const tablesWanted = doc.slides.filter((s) => kinds(s).includes('table')).length, tables = m.x.slides.filter((s) => s.includes('<a:tbl>')).length;
      checks.export.nativeDetail = { missingText: miss.slice(0, 10), chartsWanted, chartParts, tablesWanted, tables, slideCountMatch: m.x.slideCount === doc.slides.length };
      checks.export.native = miss.length < doc.slides.reduce((n, s) => n + expectedStrings(s).length, 0) && chartParts >= chartsWanted && tables >= tablesWanted && m.x.slideCount === doc.slides.length;
      if (miss.length) reasons.push(`export missing ${miss.length} expected strings as native text (e.g. ${miss[0]})`);
      if (chartParts < chartsWanted) reasons.push(`export native charts ${chartParts}/${chartsWanted}`);
      if (tables < tablesWanted) reasons.push(`export native tables ${tables}/${tablesWanted}`);
    }
    if (m.im.ok) {
      const imp = m.im.doc, impStr = JSON.stringify(imp);
      const lost = doc.slides.flatMap((s) => expectedStrings(s).filter((t) => !impStr.includes(JSON.stringify(t).slice(1, -1))));
      const kindLost = [];
      doc.slides.forEach((s, i) => { const want = kinds(s), got = imp.slides?.[i] ? kinds(imp.slides[i]) : []; for (const k of want) if (!got.includes(k)) kindLost.push(`${i}:${k}`); });
      checks.reimport.slideCount = `${imp.slides?.length}/${doc.slides.length}`;
      checks.reimport.lostText = lost.slice(0, 8); checks.reimport.lostKinds = kindLost;
      checks.reimport.retained = lost.length === 0 && kindLost.length === 0 && imp.slides?.length === doc.slides.length;
      checks.reimport.pass = checks.reimport.retained || checks.reimport.diagnostics.length > 0;
      if (!checks.reimport.retained) reasons.push(`re-import loses ${kindLost.length ? 'payload kinds ' + kindLost.join(',') : ''}${lost.length ? ' ' + lost.length + ' strings' : ''}${checks.reimport.diagnostics.length ? ' (diagnostics: ' + checks.reimport.diagnostics.join(',') + ')' : ' (no diagnostic)'}`.replace('loses  ', 'loses '));
    }
    if (!checks.catalog.pass) reasons.push(`unresolved references: ${unresolved.join(', ')}`);
    if (checks.render.diagnostics.length) reasons.push(`preview diagnostics: ${checks.render.diagnostics.join(',')}`);
    if (checks.export.diagnostics.length) reasons.push(`export diagnostics: ${checks.export.diagnostics.join(',')}`);
    checks.evidence = nativeEvidence(new RegExp(`gallery:blocks/${item.slug}|"${item.slug}"`));
    out.variants.published = { checks, ...classify({ checks, reasons }) };
    out.editorPathSlugAgnostic = editorSame;
    out.editorMatchesSnippet = JSON.stringify(JSON.parse(editorDocs[item.slug])) === JSON.stringify(doc);
    Object.assign(out, pick(out));
    results.push(out);
  }
}

// ---------- LAYOUTS ----------
if (want('layouts')) {
  const items = (await data('layouts')).items.slice(0, LIMIT);
  for (const item of items) {
    const origin = coreLayoutIds.has(item.id) ? 'core-catalog' : 'gallery-inline-record';
    const out = { dimension: 'layouts', id: item.id, master: item.master, origin, placeholders: (item.placeholders ?? []).map((p) => p.type), variants: {} };
    let doc;
    try { doc = JSON.parse(snippets.buildOpfSnippet('layouts', item.id)); } catch (e) {
      out.variants.published = { checks: { schema: { pass: false, errors: [errInfo(e).message] } }, class: 'broken', reasons: ['gallery snippet builder threw: ' + errInfo(e).message] };
      Object.assign(out, pick(out)); results.push(out); continue;
    }
    const base = clone(doc); delete base.slides[0].layout; delete base.slides[0].design; delete base.slides[0].composition; delete base.catalogs;
    const m = await measure(doc, base), checks = commonChecks(m), reasons = [];
    const inl = inlineIds(doc, 'layouts');
    checks.catalog = { pass: coreLayoutIds.has(item.id) || inl.has(item.id), via: coreLayoutIds.has(item.id) ? 'core bundled catalog' : inl.has(item.id) ? 'inline catalogs.layouts.records' : 'unresolved' };
    if (m.r.ok) {
      checks.render.resolvedLayout = m.r.resolvedLayouts[0];
      if (m.r.resolvedLayouts[0] !== item.id) reasons.push(`preview resolved layout ${m.r.resolvedLayouts[0]} instead of ${item.id}`);
    }
    const wanted = out.placeholders.filter((t) => !['title', 'subtitle', 'tag'].includes(t));
    if (m.x.ok && m.xb?.ok) {
      const s = m.x.slides[0], sb = m.xb.slides[0];
      // FF-51: placement is every shape's box plus where text sits inside it (body anchor, paragraph algn),
      // the native form of the preview's text-anchor that the SVG comparison already sees.
      const g = placementSignature(s), gb = placementSignature(sb);
      const natives = { chart: m.x.names.some((n) => /^ppt\/charts\//.test(n)), table: s.includes('<a:tbl>'), picture: s.includes('<p:pic>'), diagram: s.includes('<p:pic>') };
      const missing = uniq(wanted.filter((t) => natives[t] === false));
      const alignment = m.r.ok ? alignmentAgreement(m.r.svgs[0] ?? '', s) : null;
      checks.export.nativeDetail = { placementDiffers: g !== gb, geometryDiffers: geometry(s) !== geometry(sb), alignment, shapes: count(s, /<p:sp>/g), pics: count(s, /<p:pic>/g), graphicFrames: count(s, /<p:graphicFrame>/g), missingNativePayloads: missing };
      checks.export.native = g !== gb;
      if (missing.length) reasons.push(`export lacks native ${missing.join('/')} for placeholders`);
      if (alignment?.mismatches.length) reasons.push(`export paragraph alignment differs from preview for ${alignment.mismatches.length} of ${alignment.compared} texts (e.g. ${JSON.stringify(alignment.mismatches[0].text)}: preview ${alignment.mismatches[0].preview}, native ${alignment.mismatches[0].native})`);
    } else checks.export.native = null;
    if (m.im.ok) {
      const s0 = m.im.doc.slides?.[0] ?? {};
      checks.reimport.layoutRetained = s0.layout === item.id;
      const got = kinds(s0), lostKinds = uniq(wanted.map((t) => ({ list: 'items', picture: 'image', diagram: 'image', text: null, media: 'video', metric: 'metric', code: 'code' }[t] ?? t)).filter((k) => k && !['video', 'code'].includes(k) && !got.includes(k) && !JSON.stringify(s0).includes(`"${k}"`)));
      checks.reimport.lostKinds = lostKinds;
      checks.reimport.retained = checks.reimport.layoutRetained;
      checks.reimport.pass = checks.reimport.retained || checks.reimport.diagnostics.length > 0;
      if (!checks.reimport.layoutRetained) reasons.push(checks.reimport.diagnostics.length ? `re-import drops layout id (diagnostics: ${checks.reimport.diagnostics.join(',')})` : 're-import drops layout id silently (geometry flattened)');
      if (lostKinds.length) reasons.push(`re-import loses payload kinds ${lostKinds.join(',')}`);
    }
    if (checks.render.effect === false && checks.export.native === false && checks.render.resolvedLayout === item.id) {
      // Renderer resolved and applied the layout, but its geometry equals the engine default for this content.
      checks.render.effect = 'default-equivalent'; checks.export.native = 'default-equivalent';
      reasons.push('layout resolves but geometry is identical to the no-layout default in both preview and export (no distinguishable effect)');
    } else {
      if (checks.render.effect === false) reasons.push('preview identical with and without layout');
      if (checks.export.native === false) reasons.push(checks.render.effect === true ? 'export shape placement ignores layout that changes preview (preview/export disagree)' : 'export shape placement identical with and without layout');
    }
    if (checks.render.diagnostics.length) reasons.push(`preview diagnostics: ${checks.render.diagnostics.join(',')}`);
    if (checks.export.diagnostics.length) reasons.push(`export diagnostics: ${checks.export.diagnostics.join(',')}`);
    checks.evidence = nativeEvidence(new RegExp(`"layout"\\s*:\\s*"${item.id.replace(/[-]/g, '\\-')}"`));
    const v = { checks, ...classify({ checks, reasons }) };
    if (item.master === 'Gallery' && origin !== 'core-catalog') { v.measuredClass = v.class; v.class = 'gallery-only'; v.reasons = ['legacy gallery slug with no OPF canonical id; portable only via inline catalogs.layouts.records', ...v.reasons]; }
    out.variants.published = v;
    Object.assign(out, pick(out));
    results.push(out);
  }
}

// ---------- disagreement + summary ----------
for (const r of results) {
  const c = r.checks; if (!c?.render) continue;
  const d = [];
  if (typeof c.render.effect === 'boolean' && typeof c.export.native === 'boolean' && c.render.effect !== c.export.native) d.push(`preview effect=${c.render.effect} but export native=${c.export.native}`);
  const rd = c.render.diagnostics ?? [], xd = c.export.diagnostics ?? [];
  if (rd.join() !== xd.join()) d.push(`diagnostics differ: preview[${rd.join(',')}] export[${xd.join(',')}]`);
  r.previewExportDisagreement = d;
}
const summary = {};
for (const r of results) {
  const s = (summary[r.dimension] ??= { total: 0, counts: {}, reasons: {}, disagreements: 0, withAssetsCounts: {} });
  s.total++; s.counts[r.class] = (s.counts[r.class] ?? 0) + 1;
  if (r.withAssetsClass) s.withAssetsCounts[r.withAssetsClass] = (s.withAssetsCounts[r.withAssetsClass] ?? 0) + 1;
  if (r.previewExportDisagreement?.length) s.disagreements++;
  for (const reason of r.reasons ?? []) { const key = reason.replace(/\(e\.g\..*?\)|"[^"]*"|identical OPF to .*|same OPF background as .*|\d+:[^,)]+|\d+/g, '#').slice(0, 140); s.reasons[key] = (s.reasons[key] ?? 0) + 1; }
}
const head = (repo) => { try { return preq('child_process').execSync('git rev-parse HEAD', { cwd: repo }).toString().trim(); } catch { return null; } };
const meta = { generatedBy: 'dimension-audit/A/scripts/audit.mjs', node: process.version, commits: { opf: head(CORE), 'opf-render': head(RENDER), 'opf-pptx': head(PPTX), 'pptx-gallery': head(GALLERY) }, coreBundledLayouts: coreLayoutIds.size, method: 'gallery lib/opf-snippets.ts builders bundled with esbuild; @openpresentation/opf linked to local core dist; opf-render/opf-pptx from source; engine default text measurement (Office font registry probed separately); no Office/COM.' };
await writeFile(path.join(OUT, ONLY ? `results.${ONLY.join('_')}.json` : 'results.json'), JSON.stringify({ meta, summary, results }, null, 1));
console.log(JSON.stringify({ meta: meta.commits, summary: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { total: v.total, counts: v.counts, withAssets: v.withAssetsCounts, disagreements: v.disagreements }])) }, null, 1));
