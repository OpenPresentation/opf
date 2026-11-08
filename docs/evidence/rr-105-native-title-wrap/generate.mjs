// Run after the candidate source is committed/built. This makes no Office calls and never modifies render goldens.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const args = Object.fromEntries(Array.from({length: (process.argv.length - 2) / 2}, (_, index) => [process.argv[2 + index * 2], process.argv[3 + index * 2]]));
assert.ok(args['--out'] && args['--expect-source'], '--out <fresh directory> --expect-source <full SHA> required');
const root = fileURLToPath(new URL('../../../', import.meta.url)), out = path.resolve(args['--out']);
assert.equal(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), args['--expect-source']);
assert.equal(execFileSync('git', ['-C', root, 'diff', 'HEAD', '--', 'packages/pptx/src/index.js', 'packages/pptx/src/native-body.js'], {encoding: 'utf8'}).trim(), '');
const load = relative => import(pathToFileURL(path.join(root, relative)).href);
const [{resolveSlideContext}, {composeSlide}, {examples}, {loadFonts}, {gallery}, {toPptx}, {toPng}, {slideTemplate}, {nativeTitleWrapBox, nativeWrapWidths, WRAP_MARGIN}, {unzipSync, zipSync, strFromU8, strToU8}] = await Promise.all([
  load('packages/javascript/dist/index.js'), load('packages/javascript/dist/composition.js'), load('packages/javascript/dist/examples.js'),
  load('packages/render/dist/fonts-node.js'), load('packages/gallery/dist/index.js'), load('packages/pptx/dist/index.js'), load('packages/render/dist/png.js'),
  load('packages/pptx/src/template-layouts.js'), load('packages/pptx/src/native-body.js'), load('packages/pptx/node_modules/fflate/esm/index.mjs')
]);
await fs.mkdir(out);
await fs.mkdir(path.join(out, 'pptx')); await fs.mkdir(path.join(out, 'preview')); await fs.mkdir(path.join(out, 'before'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex'), fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const manifest = {schema: 'opf-native-title-wrap/v1', sourceCommit: args['--expect-source'], fontProfile: 'office / visual', widthUnits: 'px', cases: [], sourceFiles: {}};
for (const relative of ['packages/pptx/src/index.js', 'packages/pptx/src/native-body.js', 'packages/pptx/dist/index.js', 'packages/pptx/dist/native-body.js']) manifest.sourceFiles[relative] = hash(await fs.readFile(path.join(root, relative)));
const eligible = item => item.field === 'title' && typeof item.value === 'string' && item.value.trim() && !/[\r\n]/.test(item.value)
  && item.text?.lines?.length > 1 && !item.text.overflow && !item.text.richLines && !item.text.directions?.includes('rtl')
  && !item.text.sourceLines?.some(line => line.boundary === 'hard' || line.segments?.some(segment => segment.kind === 'tab'));
for (const {file, deck} of examples) for (const index of deck.slides.keys()) {
  const context = resolveSlideContext(deck, index, {catalogs: [gallery], fonts}), geometry = composeSlide(context.slide, context.options);
  if (!(slideTemplate(context) || context.slide.layout === undefined || context.slide.layout === 'auto' || geometry.recomposed !== undefined)) continue;
  for (const item of geometry.items.filter(eligible)) {
    const number = manifest.cases.length + 1, name = String(number).padStart(2, '0') + '-' + path.basename(file, '.opf.json') + '-s' + (index + 1);
    const input = {...deck, slides: [deck.slides[index]]}, diagnostics = [], wrap = nativeTitleWrapBox(item, geometry, fonts.textMeasurement);
    // Each file retains its source canvas/design. Only slide-position furniture variables can differ from the full deck.
    const bytes = new Uint8Array(await toPptx(input, {fonts, catalogs: [gallery], bodyText: 'native', seed: 1127, timestamp: '2026-11-08T00:00:00Z', zipDate: '2026-11-08T00:00:00Z', onDiagnostic: value => diagnostics.push(value)}));
    const preview = (await toPng(input, {fonts, catalogs: [gallery], scale: .5}))[0];
    const afterPath = `pptx/${name}.pptx`, previewPath = `preview/${name}.png`;
    await fs.writeFile(path.join(out, afterPath), bytes); await fs.writeFile(path.join(out, previewPath), preview);
    const entry = {name, file, slide: index + 1, width: geometry.width, height: geometry.height, title: item.value, lines: item.text.lines,
      fontSize: item.text.fontSize, alignment: item.alignment, originalBox: item.box, wrap: wrap ?? null, need: item.box.width * WRAP_MARGIN,
      widths: nativeWrapWidths(item, [item.value], false, fonts.textMeasurement), after: {path: afterPath, sha256: hash(bytes)}, preview: {path: previewPath, sha256: hash(preview)}, diagnostics};
    if (wrap) {
      // Archive control: restore only the former exact-width native title frame. This is explicitly a geometry control, not a source-version export.
      const parts = unzipSync(bytes), key = 'ppt/slides/slide1.xml', xml = strFromU8(parts[key]);
      let changed = 0;
      parts[key] = strToU8(xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
        if (!shape.includes('name="OPF heading slides.0.title line 0"')) return shape;
        changed++;
        return shape.replace(/<a:off x="-?\d+" y="(-?\d+)"\/><a:ext cx="\d+" cy="(\d+)"\/>/,
          `<a:off x="${Math.round(item.box.x * 9525)}" y="$1"/><a:ext cx="${Math.round(item.box.width * 9525)}" cy="$2"/>`);
      }));
      assert.equal(changed, 1, name);
      const before = zipSync(parts, {mtime: new Date('2026-11-08T00:00:00Z')}), beforePath = `before/${name}.pptx`;
      await fs.writeFile(path.join(out, beforePath), before); entry.beforeGeometryControl = {path: beforePath, sha256: hash(before)};
    }
    manifest.cases.push(entry);
    console.log(`${number}: ${name} (${wrap ? 'native' : 'measured fallback'})`);
  }
}
assert.equal(manifest.cases.length, 50); assert.equal(manifest.cases.filter(entry => entry.wrap).length, 49);
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${manifest.cases.length} cases to ${out}; native Office line-text acceptance is still owed.`);
