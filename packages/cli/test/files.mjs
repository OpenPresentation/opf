// Command tests for render, export and import. They need the optional peers opf-render and opf-pptx (a devDependency
// in the workspace; installed beside the CLI in the packed-install test). OPF_TEST_BIN selects an installed binary.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {inflateRawSync} from 'node:zlib';
const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL('../dist/index.js', import.meta.url));
const goldenFile = fileURLToPath(new URL('./fixtures/render-hashes.json', import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(), 'opf-files-test-'));
let checks = 0;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function run(args, {input, status = 0, cwd = temp, bin = executable} = {}) {
  const result = spawnSync(process.execPath, [bin, ...args], {cwd, input: typeof input === 'string' ? Buffer.from(input) : input, encoding: 'buffer', timeout: 120000, maxBuffer: 256 * 1024 * 1024});
  const stdout = result.stdout.toString('utf8'), stderr = result.stderr.toString('utf8');
  assert.equal(result.status, status, JSON.stringify({args, stdout: stdout.slice(0, 2000), stderr: stderr.slice(0, 2000)}));
  checks++;
  const text = stdout.trim() ? stdout : stderr;
  let report; try { report = JSON.parse(text); } catch { /* binary stdout */ }
  return {report, raw: result.stdout, stderr, stderrJson: (() => { try { return JSON.parse(stderr); } catch { return undefined; } })()};
}
const read = file => readFile(path.join(temp, file));
// Entry names of a ZIP file, from its central directory.
function zipNames(bytes) {
  const names = [];
  let end = bytes.length - 22;
  while (end >= 0 && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  assert.ok(end >= 0, 'end of central directory');
  let offset = bytes.readUInt32LE(end + 16);
  for (let index = bytes.readUInt16LE(end + 10); index > 0; index--) {
    const length = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32);
    names.push(bytes.toString('utf8', offset + 46, offset + 46 + length));
    offset += 46 + length + extra + comment;
  }
  return names;
}
function zipEntry(bytes, wanted) {
  let end = bytes.length - 22;
  while (bytes.readUInt32LE(end) !== 0x06054b50) end--;
  let offset = bytes.readUInt32LE(end + 16);
  for (let index = bytes.readUInt16LE(end + 10); index > 0; index--) {
    const method = bytes.readUInt16LE(offset + 10), size = bytes.readUInt32LE(offset + 20), length = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32), local = bytes.readUInt32LE(offset + 42);
    if (bytes.toString('utf8', offset + 46, offset + 46 + length) === wanted) {
      const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
      const data = bytes.subarray(start, start + size);
      return method === 0 ? data : inflateRawSync(data);
    }
    offset += 46 + length + extra + comment;
  }
  return undefined;
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const logo = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect width="200" height="100" fill="#c33"/><circle cx="100" cy="50" r="30" fill="#fff"/></svg>';
try {
  const deck = {name: 'Files test', slides: [{id: 's1', title: 'Quarterly review', text: 'Revenue grew in every region.'}, {id: 's2', title: 'Priorities', items: ['Ship', 'Measure', 'Learn']}, {id: 's3', title: 'Thank you', text: 'Questions?'}]};
  await writeFile(path.join(temp, 'deck.opf.json'), JSON.stringify(deck));

  // render: per-slide SVG, report shape shared with opf lint, digests match the files, repeat runs agree.
  const first = run(['render', 'deck.opf.json', '--out', 'svg1']).report;
  assert.equal(first.ok, true); assert.equal(first.written, true); assert.equal(first.format, 'svg');
  assert.equal(first.valid, true); assert.equal(first.schemaValid, true); assert.deepEqual(Object.keys(first.counts), ['error', 'warning', 'info']);
  assert.equal(first.sha256, sha(await read('deck.opf.json')), 'report digest equals the opf validate/lint digest of the input');
  assert.deepEqual((await readdir(path.join(temp, 'svg1'))).sort(), ['Files-test-001.svg', 'Files-test-002.svg', 'Files-test-003.svg']);
  assert.deepEqual(first.outputs.map(item => item.slide), [1, 2, 3]);
  for (const item of first.outputs) {assert.equal(item.sha256, sha(await readFile(item.file))); assert.equal(item.width, 1280); assert.equal(item.height, 720);}
  assert.ok(first.fonts.substitutions.some(item => item.requested === 'Aptos' && item.resolved === 'Intos'), 'bundled Intos stands in for Aptos');
  assert.equal(first.fonts.userFonts.length, 0);
  const svgText = (await read('svg1/Files-test-001.svg')).toString('utf8');
  assert.ok(svgText.includes('Quarterly review') && svgText.includes('@font-face'), 'SVG is standalone: it carries the faces its text names');
  assert.ok(!/(?:href|src)="https?:|url\(\s*["']?https?:/i.test(svgText), 'no remote reference in the SVG (font license text may name URLs)');
  assert.ok(svgText.length < 8 * 1024 * 1024, 'only the used faces are embedded');
  const second = run(['render', 'deck.opf.json', '--out', 'svg2']).report;
  assert.deepEqual(second.outputs.map(item => item.sha256), first.outputs.map(item => item.sha256), 'deterministic SVG');
  run(['render', 'deck.opf.json', '--out', 'svg1'], {status: 1});
  run(['render', 'deck.opf.json', '--out', 'svg1', '--force']);
  const bare = run(['render', 'deck.opf.json', '--out', 'svg3', '--svg-fonts', 'none']).report;
  assert.ok(bare.outputs[0].bytes < 20000, 'font embedding can be turned off');
  // Pinned digests for this fixture on the installed renderer; set UPDATE_GOLDEN=1 after a renderer or core bump.
  {
    const golden = JSON.parse(await readFile(goldenFile, 'utf8'));
    const actual = {svg: first.outputs.map(item => item.sha256), renderer: first.renderer.version, opf: first.opfVersion};
    if (process.env.UPDATE_GOLDEN) await writeFile(goldenFile, `${JSON.stringify(actual, null, 2)}\n`);
    else if (golden.renderer === actual.renderer && golden.opf === actual.opf) assert.deepEqual(actual.svg, golden.svg, 'SVG digests changed: run with UPDATE_GOLDEN=1 if the change is intended');
    else console.log(`NOTE golden SVG digests are for renderer ${golden.renderer}/core ${golden.opf}; installed ${actual.renderer}/${actual.opf} skipped them.`);
  }

  // render: PNG at a scale, a slide selection, one slide to stdout.
  const pngs = run(['render', 'deck.opf.json', '--format', 'png', '--scale', '0.5', '--slides', '1,3', '--out', 'png1']).report;
  assert.deepEqual(pngs.outputs.map(item => [item.slide, item.width, item.height]), [[1, 640, 360], [3, 640, 360]]);
  assert.deepEqual((await readdir(path.join(temp, 'png1'))).sort(), ['Files-test-001.png', 'Files-test-003.png']);
  assert.deepEqual([...(await read('png1/Files-test-001.png')).subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  const again = run(['render', 'deck.opf.json', '--format', 'png', '--scale', '0.5', '--slides', '1,3', '--out', 'png2']).report;
  assert.deepEqual(again.outputs.map(item => item.sha256), pngs.outputs.map(item => item.sha256), 'deterministic PNG');
  const piped = run(['render', 'deck.opf.json', '--format', 'png', '--slides', '2', '--out', '-', '--scale', '0.25']);
  assert.deepEqual([...piped.raw.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]); assert.equal(piped.stderrJson.outputs[0].sha256, sha(piped.raw));
  run(['render', 'deck.opf.json', '--slides', '4'], {status: 2}); run(['render', 'deck.opf.json', '--slides', '3-1'], {status: 2}); run(['render', 'deck.opf.json', '--slides', 'x'], {status: 2});
  run(['render', 'deck.opf.json', '--format', 'pdf'], {status: 2}); run(['render', 'deck.opf.json', '--scale', '99', '--format', 'png'], {status: 2});
  run(['render', 'deck.opf.json', '--out', '-'], {status: 2}); // three slides cannot go to one stdout stream
  run(['render', '--oops'], {status: 2}); run(['render'], {status: 2});
  const stdinRender = run(['render', '-', '--slides', '1', '--out', 'stdin.svg'], {input: JSON.stringify(deck)}).report;
  assert.equal(stdinRender.input.file, '-'); assert.ok((await read('stdin.svg')).length > 1000);

  const bom = run(['render', '-', '--slides', '1', '--out', 'bom.svg'], {input: `﻿${JSON.stringify(deck)}`}).report;
  assert.equal(bom.sha256, sha(Buffer.from(`﻿${JSON.stringify(deck)}`)), 'a BOM stays in the digest, as for opf validate');

  // Lint-shaped diagnostics: invalid documents never render; warnings fail only under --strict and nothing is written then.
  await writeFile(path.join(temp, 'bad.opf.json'), '{"slides":"bad"}');
  const bad = run(['render', 'bad.opf.json', '--out', 'bad-out'], {status: 1}).report;
  assert.equal(bad.ok, false); assert.equal(bad.written, false); assert.ok(bad.diagnostics.some(item => item.severity === 'error' && item.ruleId.startsWith('opf/')));
  assert.equal((await readdir(temp)).includes('bad-out'), false);
  run(['render', 'missing.opf.json'], {status: 2});
  const long = 'lorem ipsum dolor sit amet '.repeat(300);
  await writeFile(path.join(temp, 'over.opf.json'), JSON.stringify({name: 'Over', slides: [{title: 'Overflow', text: long}]}));
  const lax = run(['render', 'over.opf.json', '--out', 'over-lax']).report;
  assert.equal(lax.ok, true); assert.ok(lax.diagnostics.some(item => item.ruleId === 'render/text-overflow' && item.severity === 'warning' && item.path === '/slides/0/text' && item.help));
  const strict = run(['render', 'over.opf.json', '--out', 'over-strict', '--strict'], {status: 1}).report;
  assert.equal(strict.ok, false); assert.equal(strict.written, false); assert.equal(strict.valid, true);
  assert.equal((await readdir(temp)).includes('over-strict'), false, '--strict writes nothing when there are warnings');
  const paginated = run(['render', 'over.opf.json', '--out', 'over-pages', '--paginate', '--strict']).report;
  assert.ok(paginated.outputs.length > 1 && paginated.pagination.pages.length > 1, '--paginate splits the slide with the preview fonts');

  // Images: relative files inside the deck folder are read; anything else is a placeholder plus a diagnostic.
  await mkdir(path.join(temp, 'media', 'assets'), {recursive: true});
  await writeFile(path.join(temp, 'media', 'assets', 'pixel.png'), png);
  await writeFile(path.join(temp, 'media', 'assets', 'logo.svg'), logo);
  await writeFile(path.join(temp, 'media', 'notes.txt'), 'not an image');
  await writeFile(path.join(temp, 'outside.png'), png);
  const images = {name: 'Images', slides: [
    {title: 'Inside', image: 'assets/pixel.png'}, {title: 'Remote', image: 'https://example.invalid/a.png'},
    {title: 'Escapes', image: '../outside.png'}, {title: 'Not an image', image: 'notes.txt'}, {title: 'Missing', image: 'assets/none.png'},
  ]};
  await writeFile(path.join(temp, 'media', 'images.opf.json'), JSON.stringify(images));
  const imgReport = run(['render', 'media/images.opf.json', '--out', 'media-out']).report;
  // Output files are named by the deck's `name` ("Images"); readdir checks the exact case, also on case-insensitive file systems.
  assert.ok((await readdir(path.join(temp, 'media-out'))).includes('Images-001.svg'), 'the output file is named after the deck name, case kept');
  assert.ok((await read('media-out/Images-001.svg')).toString('utf8').includes('data:image/png;base64'), 'inside image embedded');
  const found = new Set(imgReport.diagnostics.filter(item => /asset/.test(item.ruleId)).map(item => `${item.path} ${item.ruleId}`));
  assert.ok(found.has('/slides/2/image cli/asset-blocked') && found.has('/slides/3/image cli/asset-blocked'), 'files outside the folder or not images are blocked');
  assert.ok(found.has('/slides/1/image render/unresolved-asset') && found.has('/slides/4/image render/unresolved-asset'));
  assert.ok(![...found].some(item => item.startsWith('/slides/0/')));
  const widened = run(['render', 'media/images.opf.json', '--out', 'media-out2', '--asset-dir', '.']).report;
  assert.ok(!widened.diagnostics.some(item => item.path === '/slides/2/image' && item.ruleId === 'cli/asset-blocked'), '--asset-dir widens the readable folder');
  const refused = run(['export', 'media/images.opf.json', '--format', 'pptx', '--out', 'bad-image.pptx'], {status: 1}).report;
  assert.ok(refused.diagnostics.some(item => item.ruleId === 'pptx/asset-unresolved' && item.severity === 'error'));
  assert.equal((await readdir(temp)).includes('bad-image.pptx'), false);

  // export: pptx (deterministic, structurally a package), pdf, zip, single files.
  const pptx = run(['export', 'deck.opf.json', '--format', 'pptx', '--out', 'deck.pptx']).report;
  assert.equal(pptx.ok, true); assert.equal(pptx.pptx.package, '@openpresentation/opf-pptx'); assert.equal(pptx.outputs[0].sha256, sha(await read('deck.pptx')));
  assert.equal((await read('deck.pptx')).subarray(0, 2).toString(), 'PK');
  assert.ok(zipNames(await read('deck.pptx')).includes('ppt/slides/slide3.xml'));
  assert.equal(run(['export', 'deck.opf.json', '--out', 'again.pptx']).report.outputs[0].sha256, pptx.outputs[0].sha256, 'deterministic PPTX, format inferred from --out');
  run(['export', 'deck.opf.json', '--format', 'pptx', '--out', 'deck.pptx'], {status: 1});
  run(['export', 'deck.opf.json', '--format', 'pptx', '--slides', '1'], {status: 2}); run(['export', 'deck.opf.json'], {status: 2});
  run(['export', 'deck.opf.json', '--format', 'pptx', '--chartex', 'nonsense'], {status: 2}); run(['export', 'deck.opf.json', '--format', 'pdf', '--chartex', 'native'], {status: 2});
  const references = run(['export', 'deck.opf.json', '--format', 'pptx', '--out', 'refs.pptx', '--provenance', 'references-only', '--chartex', 'fallback']).report;
  assert.notEqual(references.outputs[0].sha256, pptx.outputs[0].sha256, '--provenance changes the package');
  const noTags = run(['export', 'deck.opf.json', '--format', 'pptx', '--out', 'none.pptx', '--provenance', 'none']).report;
  assert.ok(noTags.outputs[0].bytes < pptx.outputs[0].bytes);

  const pdf = run(['export', 'deck.opf.json', '--format', 'pdf']).report;
  assert.equal((await read('Files-test.pdf')).subarray(0, 5).toString(), '%PDF-'); assert.ok(['vector', 'raster'].includes(pdf.pdf.mode)); assert.equal(pdf.outputs[0].pages, 3);
  assert.equal(run(['export', 'deck.opf.json', '--format', 'pdf', '--out', 'again.pdf']).report.outputs[0].sha256, pdf.outputs[0].sha256, 'deterministic PDF');
  assert.equal(run(['export', 'deck.opf.json', '--format', 'pdf', '--pdf-mode', 'raster', '--out', 'raster.pdf']).report.pdf.mode, 'raster');
  if (pdf.pdf.vectorSupported) {
    const vector = run(['export', 'deck.opf.json', '--format', 'pdf', '--pdf-mode', 'vector', '--out', 'vector.pdf']).report;
    assert.equal(vector.pdf.mode, 'vector'); assert.ok(vector.diagnostics.some(item => item.ruleId === 'pdf/pdf-font-embedded'));
  } else {
    const tooOld = run(['export', 'deck.opf.json', '--format', 'pdf', '--pdf-mode', 'vector', '--out', 'vector.pdf'], {status: 2});
    assert.equal(tooOld.stderrJson.code, 'peer-too-old');
    console.log('NOTE the installed opf-render writes raster PDF only; --pdf-mode vector was refused as documented.');
  }
  assert.equal(run(['export', 'deck.opf.json', '--format', 'pdf', '--slides', '2-3', '--out', 'partial.pdf']).report.outputs[0].pages, 2);

  const zip = run(['export', 'deck.opf.json', '--format', 'png', '--scale', '0.25', '--out', 'slides.zip']).report;
  const zipBytes = await read('slides.zip');
  assert.deepEqual(zipNames(zipBytes), ['Files-test-001.png', 'Files-test-002.png', 'Files-test-003.png']);
  assert.deepEqual([...zipEntry(zipBytes, 'Files-test-002.png').subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal(run(['export', 'deck.opf.json', '--format', 'png', '--scale', '0.25', '--out', 'slides2.zip']).report.outputs[0].sha256, zip.outputs[0].sha256, 'deterministic archive');
  run(['export', 'deck.opf.json', '--format', 'svg', '--svg-fonts', 'none', '--out', 'svgs.zip']);
  assert.equal(zipNames(await read('svgs.zip')).length, 3);
  run(['export', 'deck.opf.json', '--format', 'svg', '--slides', '2', '--out', 'two.svg']);
  assert.ok((await read('two.svg')).toString('utf8').includes('Priorities'));
  run(['export', 'deck.opf.json', '--format', 'svg', '--out', 'all.svg'], {status: 2});
  run(['export', 'deck.opf.json', '--format', 'png', '--out', 'png-dir', '--slides', '1-2']);
  assert.deepEqual((await readdir(path.join(temp, 'png-dir'))).sort(), ['Files-test-001.png', 'Files-test-002.png']);
  const pipedPdf = run(['export', 'deck.opf.json', '--format', 'pdf', '--out', '-']);
  assert.equal(pipedPdf.raw.subarray(0, 5).toString(), '%PDF-'); assert.equal(pipedPdf.stderrJson.outputs[0].sha256, sha(pipedPdf.raw));

  // SVG pictures export with the CLI's renderer as the PNG rasterizer (opf-pptx 0.11.9+ writes them natively).
  await writeFile(path.join(temp, 'logo.opf.json'), JSON.stringify({name: 'Logo', slides: [{title: 'Logo', image: 'media/assets/logo.svg'}]}));
  const logoExport = run(['export', 'logo.opf.json', '--format', 'pptx', '--out', 'logo.pptx']).report;
  assert.equal(logoExport.ok, true);
  const logoNames = zipNames(await read('logo.pptx'));
  if (logoNames.some(name => name.endsWith('.svg'))) assert.ok(logoNames.some(name => /media\/image.*\.png$/.test(name)), 'native SVG carries a PNG fallback');
  else console.log('NOTE the installed opf-pptx predates native SVG pictures; the SVG exports as a placeholder.');

  // import: PPTX back to OPF; text survives the round trip. Reflow notes are warnings the library reports for
  // wrapped native text, so the round trip itself is not run under --strict.
  const same = async (actual, expected) => assert.equal(await realpath(path.dirname(actual)) + path.sep + path.basename(actual), await realpath(path.dirname(expected)) + path.sep + path.basename(expected)); // 8.3 and symlinked temp folders
  const imported = run(['import', 'deck.pptx', '--out', 'back.opf.json']).report;
  assert.equal(imported.ok, true); assert.equal(imported.written, true); assert.equal(imported.valid, true);
  await same(imported.output, path.join(temp, 'back.opf.json'));
  assert.equal(imported.sha256, sha(await read('back.opf.json')));
  assert.equal(imported.input.sha256, sha(await read('deck.pptx')));
  const back = JSON.parse(await read('back.opf.json'));
  assert.deepEqual(back.slides.map(slide => slide.title), ['Quarterly review', 'Priorities', 'Thank you']);
  assert.equal(run(['validate', 'back.opf.json']).report.valid, true);
  assert.equal(run(['lint', 'back.opf.json']).report.valid, true);
  run(['import', 'deck.pptx', '--out', 'back.opf.json'], {status: 1});
  assert.equal(run(['import', 'deck.pptx', '--out', 'back.opf.json', '--force']).report.sha256, imported.sha256, 'deterministic import');
  await mkdir(path.join(temp, 'cwd'));
  await same(run(['import', '../deck.pptx'], {cwd: path.join(temp, 'cwd')}).report.output, path.join(temp, 'cwd', 'deck.opf.json')); // default output is <name>.opf.json in the working directory
  const stdoutDoc = run(['import', 'deck.pptx', '--out', '-']);
  assert.equal(JSON.parse(stdoutDoc.raw).slides.length, 3); assert.equal(stdoutDoc.stderrJson.written, true);
  run(['import', '-', '--out', 'stdin.opf.json'], {input: await read('deck.pptx')});
  await writeFile(path.join(temp, 'not.pptx'), 'not a zip');
  const broken = run(['import', 'not.pptx', '--out', 'broken.opf.json'], {status: 1}).report;
  assert.equal(broken.ok, false); assert.ok(broken.counts.error > 0); assert.equal((await readdir(temp)).includes('broken.opf.json'), false);
  run(['import', 'missing.pptx'], {status: 2}); run(['import'], {status: 2}); run(['import', 'deck.pptx', '--signals', 'both.json', '--out', '-'], {status: 2});
  const strictImport = run(['import', 'deck.pptx', '--out', 'strict.opf.json', '--strict'], {status: imported.counts.warning ? 1 : 0}).report;
  assert.equal(strictImport.written, imported.counts.warning === 0);
  // Raw signals need opf-pptx 0.11.9+: supported installs write them, older installs refuse before reading anything.
  const signalsRun = spawnSync(process.execPath, [executable, 'import', 'deck.pptx', '--out', 'signals.opf.json', '--signals', 'signals.json'], {cwd: temp, encoding: 'utf8'});
  if (signalsRun.status === 0) {
    const report = JSON.parse(signalsRun.stdout);
    assert.equal(report.signals.sha256, sha(await read('signals.json'))); assert.equal(JSON.parse(await read('signals.json')).slides.length, 3);
    assert.deepEqual(JSON.parse(await read('signals.opf.json')), back, 'signals do not change the document'); checks++;
  } else {
    assert.equal(signalsRun.status, 2); assert.equal(JSON.parse(signalsRun.stderr).code, 'peer-too-old'); checks++;
    console.log('NOTE the installed opf-pptx predates import signals; --signals was refused as documented.');
  }

  // FA-08: per-slide output and PDF skip hidden slides unless --include-hidden; slides named with --slides are always written.
  const hiddenDeck = {name: 'Hidden test', slides: [{id: 'h1', title: 'Shown one'}, {id: 'h2', title: 'Backup slide', hidden: true}, {id: 'h3', title: 'Shown two'}]};
  await writeFile(path.join(temp, 'hidden.opf.json'), JSON.stringify(hiddenDeck));
  const skipped = run(['render', 'hidden.opf.json', '--out', 'hid-default']).report;
  assert.deepEqual(skipped.outputs.map(item => item.slide), [1, 3], 'hidden slide 2 is not rendered'); assert.deepEqual(skipped.skippedHidden, [2]);
  assert.deepEqual((await readdir(path.join(temp, 'hid-default'))).sort(), ['Hidden-test-001.svg', 'Hidden-test-003.svg'], 'file numbers stay the slide numbers');
  const included = run(['render', 'hidden.opf.json', '--out', 'hid-all', '--include-hidden']).report;
  assert.deepEqual(included.outputs.map(item => item.slide), [1, 2, 3]); assert.deepEqual(included.skippedHidden, []);
  assert.deepEqual(run(['render', 'hidden.opf.json', '--slides', '2', '--out', 'hid-named']).report.outputs.map(item => item.slide), [2], 'a named hidden slide is written');
  assert.equal(run(['export', 'hidden.opf.json', '--format', 'pdf', '--out', 'hid-default.pdf']).report.outputs[0].pages, 2, 'the PDF skips the hidden slide');
  assert.equal(run(['export', 'hidden.opf.json', '--format', 'pdf', '--out', 'hid-all.pdf', '--include-hidden']).report.outputs[0].pages, 3);
  run(['export', 'hidden.opf.json', '--format', 'png', '--scale', '0.25', '--out', 'hid-zip.zip']);
  assert.deepEqual(zipNames(await read('hid-zip.zip')), ['Hidden-test-001.png', 'Hidden-test-003.png'], 'the zip skips the hidden slide');
  run(['export', 'hidden.opf.json', '--format', 'pptx', '--out', 'hid.pptx', '--include-hidden'], {status: 2});
  run(['export', 'hidden.opf.json', '--format', 'pptx', '--out', 'hid.pptx']);
  await writeFile(path.join(temp, 'allhidden.opf.json'), JSON.stringify({name: 'All hidden', slides: [{title: 'One', hidden: true}, {title: 'Two', hidden: true}]}));
  const none = run(['render', 'allhidden.opf.json', '--out', 'all-hidden'], {status: 1});
  assert.match(none.stderrJson.error, /Every slide is hidden/);
  assert.equal(run(['render', 'allhidden.opf.json', '--out', 'all-hidden', '--include-hidden']).report.outputs.length, 2);

  // FA-08: output files are named by the deck's filename, else its slugified name, else the input file name (the editor's rule).
  const named = async (document, file) => { await writeFile(path.join(temp, file), JSON.stringify(document)); return run(['export', file, '--format', 'pdf']).report.outputs[0].file; };
  const base = file => path.basename(file);
  assert.equal(base(await named({filename: 'Board Pack.PDF', name: 'Ignored', slides: [{title: 'A'}]}, 'n1.opf.json')), 'Board-Pack.pdf', 'filename wins, its extension is dropped');
  assert.equal(base(await named({name: 'Q4: Review / 2026', slides: [{title: 'A'}]}, 'n2.opf.json')), 'Q4-Review-2026.pdf', 'name is slugified');
  assert.equal(base(await named({slides: [{title: 'A'}]}, 'n3.opf.json')), 'n3.pdf', 'the input file name is the last resort');
  assert.equal(base(await named({filename: '  .pptx', name: 'Fallback name', slides: [{title: 'A'}]}, 'n4.opf.json')), 'Fallback-name.pdf', 'an empty filename falls through to name');
  assert.equal(base(run(['export', 'n1.opf.json', '--format', 'pptx', '--force']).report.outputs[0].file), 'Board-Pack.pptx');
  assert.deepEqual((await readdir(temp)).filter(file => file.startsWith('Board-Pack')).sort(), ['Board-Pack.pdf', 'Board-Pack.pptx']);
  const dir = run(['render', 'n2.opf.json']).report.outputs[0].file;
  assert.equal(path.basename(path.dirname(dir)), 'Q4-Review-2026-slides'); assert.equal(path.basename(dir), 'Q4-Review-2026-001.svg');

  // Fonts and options: bad inputs are usage errors.
  run(['render', 'deck.opf.json', '--font-dir', 'does-not-exist'], {status: 2});
  await mkdir(path.join(temp, 'empty-fonts'));
  run(['render', 'deck.opf.json', '--font-dir', 'empty-fonts'], {status: 2});
  run(['render', 'deck.opf.json', '--date', '2026-02-30'], {status: 2});

  // Optional peers: without them the commands explain what to install and exit 2; everything else keeps working.
  const isolated = await mkdtemp(path.join(tmpdir(), 'opf-files-isolated-'));
  try {
    const lone = path.join(isolated, 'index.js');
    await copyFile(executable, lone);
    for (const args of [['render', path.join(temp, 'deck.opf.json')], ['export', path.join(temp, 'deck.opf.json'), '--format', 'pdf'], ['import', path.join(temp, 'deck.pptx')]]) {
      const missing = run(args, {status: 2, cwd: isolated, bin: lone});
      assert.equal(missing.stderrJson.code, 'peer-not-installed'); assert.match(missing.stderrJson.error, /npm install -g @openpresentation\/opf-(render|pptx)@/);
    }
    assert.equal(run(['validate', path.join(temp, 'deck.opf.json')], {cwd: isolated, bin: lone}).report.valid, true);
  } finally {await rm(isolated, {recursive: true, force: true});}
  console.log(`Render/export/import passed ${checks} command checks: SVG, PNG, PDF, PPTX, zip, import round trip, strict, assets, determinism.`);
} finally {await rm(temp, {recursive: true, force: true});}
