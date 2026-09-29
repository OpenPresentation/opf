// Summarize parity-results.json into PARITY.md. Usage: node summarize.mjs <results.json> <out.md> [baseline.json]
import {readFileSync, writeFileSync} from 'node:fs';
const [, , inPath, outPath, basePath] = process.argv;
const {meta, results} = JSON.parse(readFileSync(inPath, 'utf8'));
const base = basePath ? JSON.parse(readFileSync(basePath, 'utf8')) : null;
const CHECKS = ['geometry', 'text', 'fills', 'zOrder', 'slideSize', 'typefaces', 'reimport', 'fontResolution', 'theme', 'mapping'];
const dimKey = r => r.variant && r.variant !== 'published' ? `${r.dimension} (${r.variant})` : r.dimension;
const dims = [...new Set(results.map(dimKey))];
const count = (rs, cls) => rs.filter(r => r.class === cls).length;
const pattern = d => `${d.check} | ${d.reason}`;
const L = [];
L.push('# Preview vs PPTX parity: pptx.gallery values', '');
L.push(`Generated ${meta.generatedAt} by \`${meta.generatedBy}\` (Node ${meta.node}, worktree prefix \`${meta.prefix}\`). No Office was used.`, '');
L.push('Heads: ' + Object.entries(meta.heads).map(([k, v]) => `${k} \`${(v ?? '?').slice(0, 7)}\``).join(', ') + '.', '');
L.push('## What "perfect" means', '',
  'For each value, the harness builds the gallery\'s own OPF Config document. It renders the traced preview (`renderSvgDeck` with `trace:true`, plus `resolvePresentation` geometry) and exports it with `toPptx`. It then compares the two element by element. PPTX shapes are mapped to preview items in two ways: by the exporter\'s stable object names (`OPF heading|text|card <path> line N`), or else by geometric containment in the composed item box. The slide-image picture (`OPF slide image slides.N`, FF-26) maps to the preview slide-image group; its frame is compared as the visible image rect (the frame widened by `a:srcRect`, clipped to the frame).', '',
  '| check | pass means |', '|---|---|',
  '| geometry | the rendered text line extent (left edge from the anchor and the line width by core measureText; PPTX: box x + marL, centered or right-aligned in the box) and baseline (box y + size) are within 0.02 pt. Chart, table, picture and card frames equal the composed box within 0.02 pt. The crop (`a:srcRect`) of a picture places the image content where the preview `preserveAspectRatio` does, within 0.02 pt at the visible edges. Deltas up to 0.5 pt count as near; a non-finite delta (NaN or infinite geometry, or a crop that leaves no image) fails. |',
  '| text | Same line text; same run segmentation; per run, the same family in the script slot used by the text (latin/ea/cs), size within 0.005 pt, bold, italic and resolved RGB colour (srgb, or schemeClr resolved through theme1); same paragraph alignment; same list markers. Native charts: preview labels exist in the chart caches, and the chart XML names the preview font. |',
  '| fills | Same background kind and colour. Per element group, the same set of solid fill colours (table cell fills included) and the same image count and bytes (sha256). Chart series colours appear in the preview. |',
  '| zOrder | The order of mapped element groups in spTree matches SVG paint order, and the slide count matches. |',
  '| slideSize | `p:sldSz` equals the SVG viewBox within 0.02 pt. |',
  '| typefaces | Every `typeface=` in every part (charts and embedded workbook styles included) and every font listed in app.xml is a family the preview uses. Theme per-script supplements are reported separately and are not gated. |',
  '| reimport | `fromPptx` preserves design.colorScheme, fontScheme, theme, background, dimensions, language, narrative, tone, audience and slide layout ids. A loss with a specific diagnostic counts as near; a silent loss fails. |',
  '| fontResolution | Every family the preview uses resolves, in the office pack with visual substitution, to the real face (`exact`) or to a metric-compatible substitute. A visual substitute or a missing face fails. |',
  '| theme | Theme major/minor latin equal the preview heading/body fonts, and the theme clrScheme equals the document colour scheme. |',
  '| mapping | Every preview element group has PPTX shapes and the reverse. An unmapped PPTX shape counts as near. A slide-image picture with no preview slide image fails. |', '',
  'Classification: **perfect** means every check passes; **near** means only near deltas; **mismatch** means at least one check fails. Both engines use the default layout measurement (no host registry), so geometry is computed from the same composition.', '');
L.push('## Per-dimension counts', '', `| dimension | n | perfect | near | mismatch | ${CHECKS.join(' | ')} |`, `|---|---|---|---|---|${CHECKS.map(() => '---').join('|')}|`);
const pct = (rs, c) => { const p = rs.filter(r => r.checks?.[c] === 'pass').length; return `${p}/${rs.length}`; };
for (const d of dims) { const rs = results.filter(r => dimKey(r) === d); L.push(`| ${d} | ${rs.length} | ${count(rs, 'perfect')} | ${count(rs, 'near')} | ${count(rs, 'mismatch')} | ${CHECKS.map(c => pct(rs, c)).join(' | ')} |`); }
L.push(`| **all** | ${results.length} | ${count(results, 'perfect')} | ${count(results, 'near')} | ${count(results, 'mismatch')} | ${CHECKS.map(c => pct(results, c)).join(' | ')} |`, '');
L.push('The check columns count values that pass that check. A value is perfect only when every check passes.', '');
if (meta.cropCheck) L.push(`Picture crop-position check: ${meta.cropCheck.measured} of ${meta.cropCheck.pictures} pictures measured; ${meta.cropCheck.unmeasured} unmeasured (preview image size unknown, reported as near).`, '');
if (base) {
  const bk = r => `${r.dimension}|${r.id}|${r.variant}`; const bm = new Map(base.results.map(r => [bk(r), r]));
  L.push('## Before / after', '', `Baseline heads: ${Object.entries(base.meta.heads).map(([k, v]) => `${k} \`${(v ?? '?').slice(0, 7)}\``).join(', ')}.`, '', '| dimension | perfect before | perfect after | near before | near after | improved | regressed |', '|---|---|---|---|---|---|---|');
  const rank = {perfect: 2, near: 1, mismatch: 0};
  for (const d of [...dims, '**all**']) { const rs = d === '**all**' ? results : results.filter(r => dimKey(r) === d); const bs = rs.map(r => bm.get(bk(r))).filter(Boolean);
    const imp = rs.filter(r => bm.has(bk(r)) && rank[r.class] > rank[bm.get(bk(r)).class]).length, reg = rs.filter(r => bm.has(bk(r)) && rank[r.class] < rank[bm.get(bk(r)).class]).length;
    L.push(`| ${d} | ${count(bs, 'perfect')} | ${count(rs, 'perfect')} | ${count(bs, 'near')} | ${count(rs, 'near')} | ${imp} | ${reg} |`); }
  L.push('');
}
// top mismatch reasons per dimension
L.push('## Top mismatch reasons per dimension', '');
for (const d of dims) {
  const rs = results.filter(r => dimKey(r) === d); const c = {};
  for (const r of rs) { if (r.fatal) { c['fatal | ' + r.fatal] = (c['fatal | ' + r.fatal] ?? 0) + 1; } for (const x of new Set((r.diffs ?? []).filter(x => x.status === 'fail').map(pattern))) c[x] = (c[x] ?? 0) + 1; }
  const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5);
  L.push(`- **${d}** (${rs.length}): ` + (top.length ? top.map(([k, n]) => `${k} (${n})`).join('; ') : 'none'));
}
L.push('');
// 20 most common patterns across all values
const pat = {};
for (const r of results) {
  if (r.fatal) { const k = `fatal | ${r.fatal}`; pat[k] ??= {n: 0, status: 'fail', ex: [], samples: []}; pat[k].n++; if (pat[k].ex.length < 3) pat[k].ex.push(`${r.dimension}/${r.id}`); }
  for (const d of r.diffs ?? []) { const k = pattern(d); pat[k] ??= {n: 0, status: d.status, ex: [], samples: [], occ: 0}; pat[k].n++; pat[k].occ = (pat[k].occ ?? 0) + d.count;
    if (pat[k].ex.length < 3) pat[k].ex.push(`${r.dimension}/${r.id}${r.variant !== 'published' ? '@' + r.variant : ''}${d.where?.length ? ' [' + d.where[0] + ']' : ''}`); if (d.samples?.[0] && pat[k].samples.length < 1) pat[k].samples.push(d.samples[0]); }
}
L.push('## 20 most common mismatch patterns', '', '| # | pattern (check \\| reason) | severity | values | occurrences | example ids | sample |', '|---|---|---|---|---|---|---|');
Object.entries(pat).filter(([, v]) => v.status === 'fail').sort((a, b) => b[1].n - a[1].n).slice(0, 20).forEach(([k, v], i) => L.push(`| ${i + 1} | ${k.replace(/\|/g, '\\|')} | ${v.status} | ${v.n} | ${v.occ ?? v.n} | ${v.ex.join('<br>')} | ${(v.samples[0] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`));
L.push('', '## Near-only patterns (tolerable deltas)', '', '| pattern | values | example |', '|---|---|---|');
Object.entries(pat).filter(([, v]) => v.status === 'near').sort((a, b) => b[1].n - a[1].n).slice(0, 10).forEach(([k, v]) => L.push(`| ${k.replace(/\|/g, '\\|')} | ${v.n} | ${v.ex[0]} |`));
// font resolution
const fr = {}; for (const r of results) for (const [f, v] of Object.entries(r.fontResolution ?? {})) { fr[f] ??= {status: v.status, resolved: v.resolved, n: 0}; fr[f].n++; }
const byStatus = s => Object.entries(fr).filter(([, v]) => v.status === s).sort((a, b) => b[1].n - a[1].n);
L.push('', '## Preview font resolution', '', 'Families the traced preview uses plus the resolved design heading/body/code fonts, resolved against the office pack (plus base) with `substitutionPolicy:"visual"`. "Metric" follows the `FONT_COMPATIBILITY` policy in opf-render.', '', '| status | families | values affected | families (values) |', '|---|---|---|---|');
for (const s of ['real', 'metric-substitute', 'visual-substitute', 'missing']) { const e = byStatus(s); const vals = results.filter(r => Object.values(r.fontResolution ?? {}).some(v => v.status === s)).length; L.push(`| ${s} | ${e.length} | ${vals} | ${e.slice(0, 40).map(([f, v]) => `${f}${v.resolved && v.resolved !== f ? '→' + v.resolved : ''} (${v.n})`).join(', ')}${e.length > 40 ? ', …' : ''} |`); }
const renderOk = results.filter(r => r.fontResolution && Object.values(r.fontResolution).every(v => v.status === 'real' || v.status === 'metric-substitute')).length;
L.push('', `${renderOk}/${results.length} values render only with the chosen font or a metric-compatible substitute.`, '');
// typeface inventory
const sup = new Set(); for (const r of results) for (const f of r.typefaces?.scriptSupplementFaces ?? []) sup.add(f);
const fset = {}; for (const r of results) for (const f of r.typefaces?.foreign ?? []) fset[f] = (fset[f] ?? 0) + 1;
L.push('## Package typeface inventory', '', 'Foreign `typeface=` values are those not used by the preview; they are listed by part, with the number of values affected:', '', ...Object.entries(fset).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([f, n]) => `- \`${f}\` — ${n}`), '',
  `Theme per-script supplements (\`<a:font script=…>\`) are listed separately and not gated: ${sup.size} distinct faces (${[...sup].slice(0, 12).join(', ')}${sup.size > 12 ? ', …' : ''}).`, '');
L.push('## Re-running', '', '```powershell', 'dimension-audit\\parity\\run.ps1                          # current worktrees -> parity-results.json + PARITY.md',
  'dimension-audit\\parity\\run.ps1 -Update                  # move sources\\parity-* to origin/main, rebuild, rerun',
  'dimension-audit\\parity\\build.ps1 -Prefix pr123; dimension-audit\\parity\\run.ps1 -Prefix pr123 -Baseline dimension-audit\\parity\\parity-results.json -Out dimension-audit\\parity\\out\\pr123.json', '```', '',
  'For a fix PR, create `sources\\<prefix>-{opf,opf-render,opf-pptx,pptx-gallery}` worktrees with the PR branch in the repo you changed and origin/main elsewhere. The report then adds a before/after table.', '');
writeFileSync(outPath, L.join('\n'));
console.log(`perfect ${count(results, 'perfect')} near ${count(results, 'near')} mismatch ${count(results, 'mismatch')} of ${results.length}`);
