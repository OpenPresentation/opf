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
// The preview font host the run modelled (meta.fontHost, since 2026-09-30; runs before that used the office-only model).
const hostNote = m => ({
  gallery: 'Modelled preview font host: the pptx.gallery editor (font-host.mjs). Its browser registry is built from the eager faces of the office pack with `substitutionPolicy:"visual"` and `fallbackFamily:"Roboto"`, and its font gate (opf-editor `createFontGate`) runs `ensureLazyFonts(document)` and `ensureScripts(document)` before the document is rendered, which loads the vendored preview faces (Intos, the open pack) and the script (Noto) faces that the text and font schemes of the value need. The same calls run here against the same package files (Font Loading API and fetch stood in for), one registry per distinct load. A family the loaded registry does not serve, or serves only through the generic fallback, fails fontResolution; so does a value whose strict measured render with that registry throws. This models the browser host in Node; no browser draws anything.',
  'node-auto': 'Modelled preview font host: opf-render in Node, `loadFonts({pack:"office", substitutionPolicy:"visual", scripts:"auto", presentation})` for the own document of the value.',
  'office-only': 'Modelled preview font host: the office pack with `substitutionPolicy:"visual"` and no `scripts` (Noto script) pack, as before 2026-09-30. It does not model the shipped hosts, which load script faces on demand; a family that only the script pack serves fails fontResolution with "preview has no face".',
})[m.fontHost] ?? 'Modelled preview font host: the office pack with `substitutionPolicy:"visual"` and no `scripts` (Noto script) pack. The shipped previews load the same: the opf-editor playground bundle that pptx.gallery embeds builds its registry with `loadOfficeFontRegistry()` and no `scripts`, the gallery layout thumbnails use no registry, and opf-render never loads the script pack by itself (a host must pass `scripts`, for example from `detectScripts(presentation)`; no shipped host does). A family that only the script pack serves therefore fails fontResolution with "preview has no face", which is a product gap, not an instrument error.';
const L = [];
L.push('# Preview vs PPTX parity: pptx.gallery values', '');
L.push(`Generated ${meta.generatedAt} by \`${meta.generatedBy}\` (Node ${meta.node}, worktree prefix \`${meta.prefix}\`). No Office was used.`, '');
L.push('Heads: ' + Object.entries(meta.heads).map(([k, v]) => `${k} \`${(v ?? '?').slice(0, 7)}\``).join(', ') + '.', '');
L.push('## What "perfect" means', '',
  'For each value, the harness builds the gallery\'s own OPF Config document. It renders the traced preview (`renderSvg` with `trace:true`, plus `resolvePresentation` geometry) and exports it with `toPptx`. It then compares the two element by element. PPTX shapes are mapped to preview items in two ways: by the exporter\'s stable object names (`OPF heading|text|card <path> line N`), or else by geometric containment in the composed item box. The slide-image picture (`OPF slide image slides.N`, FF-26) maps to the preview slide-image group; its frame is compared as the visible image rect (the frame widened by `a:srcRect`, clipped to the frame).', '',
  '| check | pass means |', '|---|---|',
  '| geometry | the rendered text line extent (left edge from the anchor and the line width by core measureText; PPTX: box x + marL, centered or right-aligned in the box) and baseline (box y + size) are within 0.02 pt. Chart, picture and card frames equal the composed box within 0.02 pt; a table frame equals the drawn preview table (the union of its cell rectangles, which can be shorter than the composed box) within 0.02 pt. The crop (`a:srcRect`) of a picture places the image content where the preview `preserveAspectRatio` does, within 0.02 pt at the visible edges. Deltas up to 0.5 pt count as near; a non-finite delta (NaN or infinite geometry, or a crop that leaves no image) fails. |',
  '| text | Same line text (plain runs `a:r` and fields `a:fld`, such as the slide number and date, which carry the rendered value in `a:t`); same run segmentation; per run, the same family in the script slot used by the text (latin/ea/cs), size exactly (within 0.001 pt, the print resolution of the preview: run sizes are whole hundredths of a point, RR-16; it was 0.005 pt before), bold, italic and resolved RGB colour (srgb, or schemeClr resolved through theme1); same paragraph alignment; same list markers. Native charts: preview labels exist in the chart caches, the chart XML names the preview font, and each text role the preview draws (axis, data labels, legend, title) has the same size in the same role of the chart part (FF-62; not "any size in the part"). |',
  '| fills | Same background kind and colour. Per element group, the same set of solid fill colours (table cell fills included) and the same image count and bytes (sha256). Chart series colours appear in the preview. |',
  '| zOrder | The order of mapped element groups in spTree matches SVG paint order, and the slide count matches. |',
  '| slideSize | `p:sldSz` equals the SVG viewBox within 0.02 pt. |',
  '| typefaces | Every `typeface=` in every part (charts and embedded workbook styles included) and every font listed in app.xml is a family the preview uses. Theme per-script supplements are reported separately and are not gated. |',
  '| reimport | `fromPptx` preserves design.colorScheme, fontScheme, theme, background, dimensions, language, narrative, tone, audience and slide layout ids. A loss with a specific diagnostic counts as near; a silent loss fails. |',
  '| fontResolution | For every family the selected design uses (owner decision, 2026-09-29; see below): **pass** when the PPTX names the selected family (theme major/minor for the heading/body fonts, run or chart slots otherwise) and the preview draws the real face (an open bundled family) or the FF-31 policy table\'s metric-compatible replacement. **near** when the PPTX names the selected family and the preview draws the policy table\'s route for it, but only at the visual look-alike tier ("visual-only replacement"; layout not guaranteed). **fail** when the family has no row in the policy table, the preview has no face for it, the preview draws a face that is not the table\'s route (an unexpected host, system or generic fallback), or the PPTX writes a replacement name instead of the selected name. The metric or visual tier is reported per family. Since FF-60 a drawn weight that toPptx writes as Regular or Bold (bold from 600) counts at the tier of the face the export selects, when the preview draws exactly that face (Aptos 500 to Intos Regular, 600 and 800 to Intos Bold); the raw registry tier stays in the legacy definition. Since 2026-09-30 the value must also pass the strict measured render with the registry of the modelled host: a value the host cannot draw (for example `font-shaping-failed`) fails. |',
  '| theme | Theme major/minor latin equal the preview heading/body fonts, and the theme clrScheme equals the document colour scheme. |',
  '| mapping | Every preview element group has PPTX shapes and the reverse. An unmapped PPTX shape counts as near. A slide-image picture with no preview slide image fails. |', '',
  'fontResolution owner decision, 2026-09-29 (verbatim): "look-alike fonts are to get around any font licensing restrictions. They are desirable for open source but if we export to PowerPoint the pptx file should include references to the font they selected and want to see in PowerPoint." Refinement, later the same day (verbatim): "if the user wants Aptos... if Aptos is license restricted we can substitute a font (Aptos2 or whatever it\'s named) that looks similar and has the same size in pixels on the screen for rendering live previews of SVG. When we export to PPTX we should have PowerPoint open that file and display actual Aptos." So a look-alike is intended, the PPTX must keep the selected name, and the target look-alike is metric-compatible; a visual-only look-alike is policy-conformant but reported as near. Before this decision the check passed only for the real face or a metric-compatible substitute; that old definition is computed from the same run (`results[].legacy`) and compared below.', '',
  hostNote(meta),
  'Classification: **perfect** means every check passes; **near** means only near deltas; **mismatch** means at least one check fails. Both engines use the default layout measurement (no host registry), so geometry is computed from the same composition.', '');
L.push('## Per-dimension counts', '', `| dimension | n | perfect | near | mismatch | ${CHECKS.join(' | ')} |`, `|---|---|---|---|---|${CHECKS.map(() => '---').join('|')}|`);
const pct = (rs, c) => { const p = rs.filter(r => r.checks?.[c] === 'pass').length; const nr = c === 'fontResolution' ? rs.filter(r => r.checks?.[c] === 'near').length : 0; return `${p}/${rs.length}${nr ? ` (+${nr} near)` : ''}`; };
for (const d of dims) { const rs = results.filter(r => dimKey(r) === d); L.push(`| ${d} | ${rs.length} | ${count(rs, 'perfect')} | ${count(rs, 'near')} | ${count(rs, 'mismatch')} | ${CHECKS.map(c => pct(rs, c)).join(' | ')} |`); }
L.push(`| **all** | ${results.length} | ${count(results, 'perfect')} | ${count(results, 'near')} | ${count(results, 'mismatch')} | ${CHECKS.map(c => pct(results, c)).join(' | ')} |`, '');
L.push('The check columns count values that pass that check (fontResolution also shows how many are near). A value is perfect only when every check passes.', '');
if (meta.cropCheck) L.push(`Picture crop-position check: ${meta.cropCheck.measured} of ${meta.cropCheck.pictures} pictures measured; ${meta.cropCheck.unmeasured} unmeasured (preview image size unknown, reported as near).`, '');
if (base) {
  const bk = r => `${r.dimension}|${r.id}|${r.variant}`; const bm = new Map(base.results.map(r => [bk(r), r]));
  L.push('## Before / after', '', `Baseline heads: ${Object.entries(base.meta.heads).map(([k, v]) => `${k} \`${(v ?? '?').slice(0, 7)}\``).join(', ')}.`, '', '| dimension | perfect before | perfect after | near before | near after | improved | regressed |', '|---|---|---|---|---|---|---|');
  const rank = {perfect: 2, near: 1, mismatch: 0};
  for (const d of [...dims, '**all**']) { const rs = d === '**all**' ? results : results.filter(r => dimKey(r) === d); const bs = rs.map(r => bm.get(bk(r))).filter(Boolean);
    const imp = rs.filter(r => bm.has(bk(r)) && rank[r.class] > rank[bm.get(bk(r)).class]).length, reg = rs.filter(r => bm.has(bk(r)) && rank[r.class] < rank[bm.get(bk(r)).class]).length;
    L.push(`| ${d} | ${count(bs, 'perfect')} | ${count(rs, 'perfect')} | ${count(bs, 'near')} | ${count(rs, 'near')} | ${imp} | ${reg} |`); }
  const cc = (rs, c) => rs.filter(r => r.checks?.[c] === 'pass').length;
  L.push('### Checks passed, before and after (all values)', '', 'Baseline: the results file passed as the baseline (a run at the same heads when the two head lists match, so the difference is the harness). Each cell is the number of values that pass the check.', '', '| check | before | after |', '|---|---|---|');
  for (const c of CHECKS) L.push(`| ${c} | ${cc(base.results, c)} | ${cc(results, c)} |`);
  L.push(`| values | ${base.results.length} | ${results.length} |`, '');
}
// old vs new fontResolution definition, from the same run
if (results.some(r => r.legacy)) {
  const oldChecks = r => ({...(r.checks ?? {}), ...(r.legacy?.checks ?? {})}); const oldClass = r => r.legacy?.class ?? r.class;
  const cnt = (rs, f, v) => rs.filter(r => f(r) === v).length;
  L.push('## fontResolution definition change (owner decision 2026-09-29): old vs new, same run', '',
    'Both columns come from the same run on the same heads. The old definition passes only the real face or a metric-compatible substitute. The new one is defined above. Every other check is identical under both, so the only difference is fontResolution and the classes that follow from it.', '',
    '| dimension | n | perfect old | perfect new | near old | near new | mismatch old | mismatch new | fontResolution pass old | pass new | near new | fail new |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const d of [...dims, '**all**']) { const rs = d === '**all**' ? results : results.filter(r => dimKey(r) === d);
    L.push(`| ${d} | ${rs.length} | ${cnt(rs, oldClass, 'perfect')} | ${count(rs, 'perfect')} | ${cnt(rs, oldClass, 'near')} | ${count(rs, 'near')} | ${cnt(rs, oldClass, 'mismatch')} | ${count(rs, 'mismatch')} | ${cnt(rs, r => oldChecks(r).fontResolution, 'pass')} | ${cnt(rs, r => r.checks?.fontResolution, 'pass')} | ${cnt(rs, r => r.checks?.fontResolution, 'near')} | ${cnt(rs, r => r.checks?.fontResolution, 'fail')} |`); }
  L.push('', '| check (all values, pass count) | old definition | new definition |', '|---|---|---|');
  for (const c of CHECKS) L.push(`| ${c} | ${cnt(results, r => oldChecks(r)[c], 'pass')} | ${cnt(results, r => r.checks?.[c], 'pass')} |`);
  L.push('');
  const fam = {};
  for (const r of results) for (const [f, v] of Object.entries(r.fontResolution ?? {})) { const e = fam[f + " " + v.verdict] ??= {n: 0, v, f}; e.n++; }
  const rowsOf = rows => rows.map(([f, e]) => `| ${e.f} | ${e.v.resolved ?? '-'} | ${e.v.licenseClass ?? 'not in policy table'} | ${e.v.route ?? '-'} | ${e.n} |`);
  const near = Object.entries(fam).filter(([, e]) => e.v.verdict === 'near').sort((a, b) => b[1].n - a[1].n || a[1].f.localeCompare(b[1].f));
  const nearRoute = near.filter(([, e]) => e.v.route === 'replacement').length;
  L.push('### Selected families with only a visual-only replacement (near)', '',
    `These ${near.length} selected families render in the preview with a policy-table look-alike that is not metric-compatible (${nearRoute} with the table's listed replacement, ${near.length - nearRoute} with a listed alternate). Each needs a metric-compatible open replacement, or a supplied real face, to pass. "values" is the number of the ${results.length} values that select the family.`, '',
    '| selected family | preview face | license class | route | values |', '|---|---|---|---|---|', ...rowsOf(near), '');
  const okFams = Object.entries(fam).filter(([, e]) => e.v.verdict === 'pass').sort((a, b) => b[1].n - a[1].n || a[1].f.localeCompare(b[1].f));
  L.push('### Selected families that pass', '', '| selected family | preview face | license class | route | values |', '|---|---|---|---|---|', ...rowsOf(okFams), '');
  const failFams = Object.entries(fam).filter(([, e]) => e.v.verdict === 'fail');
  const KINDS = ['the modelled host cannot draw this value', 'no route in the FF-31 font policy table', 'preview has no face for open family', 'preview has no face for', 'preview face is not the policy route for', 'preview uses an unexpected fallback face for', 'PPTX writes replacement name', 'PPTX does not name the selected family'];
  const kindOf = reason => KINDS.find(k => reason.startsWith(k)) ?? reason;
  const failReason = {};
  for (const r of results) for (const d of r.diffs ?? []) if (d.check === 'fontResolution' && d.status === 'fail') failReason[kindOf(d.reason)] = (failReason[kindOf(d.reason)] ?? 0) + 1;
  const allDiffs = results.flatMap(r => r.diffs ?? []);
  L.push('### fontResolution failures (new definition)', '', `${failFams.length} selected families fail. Family-value failures by reason kind (a value with several failing families counts once per family):`, '', '| reason kind | family-value failures |', '|---|---|', ...Object.entries(failReason).sort((a, b) => b[1] - a[1]).map(([k, c]) => `| ${k} | ${c} |`), '',
    '| failing family | license class | policy route | values | reason |', '|---|---|---|---|---|');
  const failSorted = failFams.sort((a, b) => b[1].n - a[1].n || a[1].f.localeCompare(b[1].f));
  for (const [, e] of failSorted.slice(0, 25)) { const f = e.f; const why = allDiffs.find(d => d.check === 'fontResolution' && d.status === 'fail' && d.where?.includes(f))?.reason ?? ''; L.push(`| ${f} | ${e.v.licenseClass ?? 'not in policy table'} | ${e.v.error ? 'not loaded in preview' : (e.v.route ?? 'unrouted')} | ${e.n} | ${why.replace(/\|/g, '\\|')} |`); }
  if (failSorted.length > 25) L.push('', `… and ${failSorted.length - 25} more failing families (one value each unless listed above); the full per-family verdicts are in the results file under results[].fontResolution.`);
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
L.push('', '## Preview font resolution (registry status, the old-definition view)', '', 'Families the traced preview uses plus the resolved design heading/body/code fonts, resolved against the office pack (plus base) with `substitutionPolicy:"visual"`. "Metric" follows the `FONT_COMPATIBILITY` policy in opf-render. This is the registry status the old definition gated on; the verdict under the new definition is in the section above.', '', '| status | families | values affected | families (values) |', '|---|---|---|---|');
for (const s of ['real', 'metric-substitute', 'visual-substitute', 'missing']) { const e = byStatus(s); const vals = results.filter(r => Object.values(r.fontResolution ?? {}).some(v => v.status === s)).length; L.push(`| ${s} | ${e.length} | ${vals} | ${e.slice(0, 40).map(([f, v]) => `${f}${v.resolved && v.resolved !== f ? '→' + v.resolved : ''} (${v.n})`).join(', ')}${e.length > 40 ? ', …' : ''} |`); }
const renderOk = results.filter(r => r.fontResolution && Object.values(r.fontResolution).every(v => v.status === 'real' || v.status === 'metric-substitute')).length;
L.push('', `${renderOk}/${results.length} values render only with the chosen font or a metric-compatible substitute (the old fontResolution pass).`, '');
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
