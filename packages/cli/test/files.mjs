// Command tests for opf convert's drawing and PowerPoint paths (RR-75: render, export and import before 0.18). They need the optional
// peers opf-render and opf-pptx (a devDependency in the workspace; installed beside the CLI in the packed-install test). OPF_TEST_BIN selects an installed binary.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile, cp, symlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {inflateRawSync} from 'node:zlib';
import {cliPeerGate, report} from '../../../scripts/unreleased-gate.mjs';
import {installIsolatedCore} from '../../../scripts/isolated-core.mjs';
const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL('../dist/index.js', import.meta.url));
// RR-55: every check here runs through the installed published opf-render and opf-pptx. While they do not satisfy the CLI's
// peer ranges (a coordinated release not on npm yet), a pull request, merge-queue or roller-candidate run skips this file with a notice; any
// other run fails (scripts/unreleased-gate.mjs).
if (!report(cliPeerGate({cliRoot: fileURLToPath(new URL('..', import.meta.url)), executable, names: ['@openpresentation/opf-render', '@openpresentation/opf-pptx']}))) process.exit(0);
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

  // SVG: one file per slide beside the output, the report envelope, digests match the files, repeat runs agree.
  const first = run(['convert', 'deck.opf.json', 'svg1/Files-test.svg']).report;
  assert.equal(first.command, 'convert'); assert.equal(first.ok, true); assert.equal(first.written, true); assert.equal(first.format, 'svg');
  assert.deepEqual(Object.keys(first.counts), ['error', 'warning', 'info']);
  assert.equal(first.input.sha256, sha(await read('deck.opf.json')), 'the input digest equals the opf validate digest');
  assert.deepEqual((await readdir(path.join(temp, 'svg1'))).sort(), ['Files-test-1.svg', 'Files-test-2.svg', 'Files-test-3.svg']);
  assert.deepEqual(first.outputs.map(item => item.slide), [1, 2, 3]);
  for (const item of first.outputs) {assert.equal(item.sha256, sha(await readFile(item.file))); assert.equal(item.width, 1280); assert.equal(item.height, 720); assert.equal(item.mediaType, 'image/svg+xml'); assert.equal(item.bytes, (await readFile(item.file)).length);}
  assert.ok(first.fonts.substitutions.some(item => item.requested === 'Aptos' && item.resolved === 'Intos'), 'bundled Intos stands in for Aptos');
  assert.equal(first.fonts.userFonts.length, 0);
  const svgText = (await read('svg1/Files-test-1.svg')).toString('utf8');
  assert.ok(svgText.includes('Quarterly review') && svgText.includes('@font-face'), 'SVG is standalone: it carries the faces its text names');
  assert.ok(!/(?:href|src)="https?:|url\(\s*["']?https?:/i.test(svgText), 'no remote reference in the SVG (font license text may name URLs)');
  assert.ok(svgText.length < 8 * 1024 * 1024, 'only the used faces are embedded');
  const second = run(['convert', 'deck.opf.json', 'svg2/Files-test.svg']).report;
  assert.deepEqual(second.outputs.map(item => item.sha256), first.outputs.map(item => item.sha256), 'deterministic SVG');
  run(['convert', 'deck.opf.json', 'svg1/Files-test.svg'], {status: 1});
  run(['convert', 'deck.opf.json', 'svg1/Files-test.svg', '--force']);
  const bare = run(['convert', 'deck.opf.json', 'svg3/Files-test.svg', '--text', 'system']).report;
  assert.ok(bare.outputs[0].bytes < 20000, 'font embedding can be turned off (--text system)');
  // Pinned digests for this fixture on the installed renderer; set UPDATE_GOLDEN=1 after a renderer or core bump.
  {
    const golden = JSON.parse(await readFile(goldenFile, 'utf8'));
    const actual = {svg: first.outputs.map(item => item.sha256), renderer: first.renderer.version, opf: first.opfVersion};
    if (process.env.UPDATE_GOLDEN) await writeFile(goldenFile, `${JSON.stringify(actual, null, 2)}\n`);
    else if (golden.renderer === actual.renderer && golden.opf === actual.opf) assert.deepEqual(actual.svg, golden.svg, 'SVG digests changed: run with UPDATE_GOLDEN=1 if the change is intended');
    else console.log(`NOTE golden SVG digests are for renderer ${golden.renderer}/core ${golden.opf}; installed ${actual.renderer}/${actual.opf} skipped them.`);
  }

  // PNG at a scale, a slide selection, one slide to stdout. The output's extension names the format: a .png output is PNG.
  const pngs = run(['convert', 'deck.opf.json', 'png1/Files-test.png', '--scale', '0.5', '--slides', '1,3']).report;
  assert.deepEqual(pngs.outputs.map(item => [item.slide, item.width, item.height, item.mediaType]), [[1, 640, 360, 'image/png'], [3, 640, 360, 'image/png']]);
  assert.deepEqual((await readdir(path.join(temp, 'png1'))).sort(), ['Files-test-1.png', 'Files-test-3.png']);
  assert.deepEqual([...(await read('png1/Files-test-1.png')).subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  const again = run(['convert', 'deck.opf.json', 'png2/Files-test.png', '--scale', '0.5', '--slides', '1,3']).report;
  assert.deepEqual(again.outputs.map(item => item.sha256), pngs.outputs.map(item => item.sha256), 'deterministic PNG');
  const single = run(['convert', 'deck.opf.json', 'single.png', '--slides', '2', '--scale', '0.25']).report;
  assert.deepEqual([...(await read('single.png')).subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'one selected slide is written to the .png output itself, as PNG');
  assert.equal(single.outputs[0].file, path.join(temp, 'single.png'));
  const piped = run(['convert', 'deck.opf.json', '-', '--to', 'png', '--slides', '2', '--scale', '0.25']);
  assert.deepEqual([...piped.raw.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]); assert.equal(piped.stderrJson.outputs[0].sha256, sha(piped.raw));
  run(['convert', 'deck.opf.json', 'x.svg', '--slides', '4'], {status: 2}); run(['convert', 'deck.opf.json', 'x.svg', '--slides', '3-1'], {status: 2}); run(['convert', 'deck.opf.json', 'x.svg', '--slides', 'x'], {status: 2});
  run(['convert', 'deck.opf.json', 'x.png', '--scale', '99'], {status: 2});
  run(['convert', 'deck.opf.json', '-', '--to', 'svg'], {status: 2}); // three slides cannot go to one stdout stream
  run(['convert', '--oops'], {status: 2}); run(['convert'], {status: 2});
  const stdinRender = run(['convert', '-', 'stdin.svg', '--slides', '1'], {input: JSON.stringify(deck)}).report;
  assert.equal(stdinRender.input.file, '-'); assert.ok((await read('stdin.svg')).length > 1000);

  const bom = run(['convert', '-', 'bom.svg', '--slides', '1'], {input: `﻿${JSON.stringify(deck)}`}).report;
  assert.equal(bom.input.sha256, sha(Buffer.from(`﻿${JSON.stringify(deck)}`)), 'a BOM stays in the digest, as for opf validate');

  // Findings in the shared format: invalid documents never draw; warnings fail only under --fail-on warning and nothing is written then.
  await writeFile(path.join(temp, 'bad.opf.json'), '{"slides":"bad"}');
  const bad = run(['convert', 'bad.opf.json', 'bad-out/bad.svg'], {status: 1}).report;
  assert.equal(bad.ok, false); assert.equal(bad.code, 'invalid-document'); assert.ok(bad.findings.some(item => item.severity === 'error' && item.ruleId.startsWith('opf/')));
  assert.equal((await readdir(temp)).includes('bad-out'), false);
  run(['convert', 'missing.opf.json', 'x.svg'], {status: 2});
  const long = 'lorem ipsum dolor sit amet '.repeat(300);
  await writeFile(path.join(temp, 'over.opf.json'), JSON.stringify({name: 'Over', slides: [{title: 'Overflow', text: long}]}));
  const lax = run(['convert', 'over.opf.json', 'over-lax/over.svg']).report;
  assert.equal(lax.ok, true); assert.ok(lax.findings.some(item => item.ruleId === 'render/text-overflow' && item.severity === 'warning' && item.path === '/slides/0/text' && item.help));
  const strict = run(['convert', 'over.opf.json', 'over-strict/over.svg', '--fail-on', 'warning'], {status: 1}).report;
  assert.equal(strict.ok, false); assert.equal(strict.code, 'findings-at-fail-on'); assert.ok(strict.outputs.every(item => item.planned));
  assert.equal((await readdir(temp)).includes('over-strict'), false, '--fail-on warning writes nothing when there are warnings');
  const paginated = run(['convert', 'over.opf.json', 'over-pages/over.svg', '--paginate', '--fail-on', 'warning']).report;
  assert.ok(paginated.outputs.length > 1 && paginated.pagination.pages.length > 1, '--paginate splits the slide with the preview fonts');
  // opf paginate measures with the same fonts when the renderer is installed.
  const measured = run(['paginate', 'over.opf.json', 'over-paged.opf.json']);
  assert.equal(measured.stderrJson?.layout ?? measured.report.layout, 'measured');

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
  const imgReport = run(['convert', 'media/images.opf.json', 'media-out/Images.svg']).report;
  assert.ok((await readdir(path.join(temp, 'media-out'))).includes('Images-1.svg'), 'the files are named by the output');
  assert.ok((await read('media-out/Images-1.svg')).toString('utf8').includes('data:image/png;base64'), 'inside image embedded');
  const found = new Set(imgReport.findings.filter(item => /asset/.test(item.ruleId)).map(item => `${item.path} ${item.ruleId}`));
  assert.ok(found.has('/slides/2/image cli/asset-blocked') && found.has('/slides/3/image cli/asset-blocked'), 'files outside the folder or not images are blocked');
  assert.ok(found.has('/slides/1/image render/unresolved-asset') && found.has('/slides/4/image render/unresolved-asset'));
  assert.ok(![...found].some(item => item.startsWith('/slides/0/')));
  const widened = run(['convert', 'media/images.opf.json', 'media-out2/Images.svg', '--asset-dir', '.']).report;
  assert.ok(!widened.findings.some(item => item.path === '/slides/2/image' && item.ruleId === 'cli/asset-blocked'), '--asset-dir widens the readable folder');
  const refused = run(['convert', 'media/images.opf.json', 'bad-image.pptx'], {status: 1}).report;
  assert.ok(refused.findings.some(item => item.ruleId === 'pptx/asset-unresolved' && item.severity === 'error'));
  assert.equal((await readdir(temp)).includes('bad-image.pptx'), false);

  // PPTX (deterministic, structurally a package), PDF, zip, single files.
  const pptx = run(['convert', 'deck.opf.json', 'deck.pptx']).report;
  assert.equal(pptx.ok, true); assert.equal(pptx.pptx.package, '@openpresentation/opf-pptx'); assert.equal(pptx.outputs[0].sha256, sha(await read('deck.pptx')));
  assert.equal((await read('deck.pptx')).subarray(0, 2).toString(), 'PK');
  assert.ok(zipNames(await read('deck.pptx')).includes('ppt/slides/slide3.xml'));
  assert.equal(run(['convert', 'deck.opf.json', 'again.pptx']).report.outputs[0].sha256, pptx.outputs[0].sha256, 'deterministic PPTX');
  run(['convert', 'deck.opf.json', 'deck.pptx'], {status: 1});
  run(['convert', 'deck.opf.json', 'x.pptx', '--slides', '1'], {status: 2});
  run(['convert', 'deck.opf.json', 'x.pptx', '--charts', 'nonsense'], {status: 2}); run(['convert', 'deck.opf.json', 'x.pdf', '--charts', 'native'], {status: 2});
  const references = run(['convert', 'deck.opf.json', 'refs.pptx', '--provenance', 'references-only', '--charts', 'picture']).report;
  assert.notEqual(references.outputs[0].sha256, pptx.outputs[0].sha256, '--provenance changes the package');
  const noTags = run(['convert', 'deck.opf.json', 'none.pptx', '--provenance', 'none']).report;
  assert.ok(noTags.outputs[0].bytes < pptx.outputs[0].bytes);

  const pdf = run(['convert', 'deck.opf.json', 'Files-test.pdf']).report;
  assert.equal((await read('Files-test.pdf')).subarray(0, 5).toString(), '%PDF-'); assert.equal(pdf.pdf.mode, 'vector', 'vector is the default PDF mode'); assert.equal(pdf.outputs[0].pages, 3);
  assert.equal(run(['convert', 'deck.opf.json', 'again.pdf']).report.outputs[0].sha256, pdf.outputs[0].sha256, 'deterministic PDF');
  assert.equal(run(['convert', 'deck.opf.json', 'raster.pdf', '--raster']).report.pdf.mode, 'raster');
  const vector = run(['convert', 'deck.opf.json', 'vector.pdf']).report;
  assert.equal(vector.pdf.mode, 'vector'); assert.ok(vector.findings.some(item => item.ruleId === 'pdf/pdf-font-embedded'));
  assert.equal(vector.outputs[0].sha256, pdf.outputs[0].sha256, 'vector is the default mode');
  assert.equal(run(['convert', 'deck.opf.json', 'partial.pdf', '--slides', '2-3']).report.outputs[0].pages, 2);

  const zip = run(['convert', 'deck.opf.json', 'slides.zip', '--scale', '0.25']).report;
  const zipBytes = await read('slides.zip');
  assert.deepEqual(zipNames(zipBytes), ['slides-1.png', 'slides-2.png', 'slides-3.png']);
  assert.deepEqual([...zipEntry(zipBytes, 'slides-2.png').subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal(run(['convert', 'deck.opf.json', 'slides2.zip', '--scale', '0.25']).report.outputs[0].entries.length, 3);
  run(['convert', 'deck.opf.json', 'svgs.zip', '--to', 'svg', '--text', 'system']);
  assert.equal(zipNames(await read('svgs.zip')).length, 3);
  run(['convert', 'deck.opf.json', 'two.svg', '--slides', '2']);
  assert.ok((await read('two.svg')).toString('utf8').includes('Priorities'));
  run(['convert', 'deck.opf.json', 'png-dir/Files-test.png', '--slides', '1-2']);
  assert.deepEqual((await readdir(path.join(temp, 'png-dir'))).sort(), ['Files-test-1.png', 'Files-test-2.png']);
  const pipedPdf = run(['convert', 'deck.opf.json', '-', '--to', 'pdf']);
  assert.equal(pipedPdf.raw.subarray(0, 5).toString(), '%PDF-'); assert.equal(pipedPdf.stderrJson.outputs[0].sha256, sha(pipedPdf.raw));

  // SVG pictures export with the CLI's renderer as the PNG rasterizer; opf-pptx writes them natively over a PNG fallback.
  await writeFile(path.join(temp, 'logo.opf.json'), JSON.stringify({name: 'Logo', slides: [{title: 'Logo', image: 'media/assets/logo.svg'}]}));
  const logoExport = run(['convert', 'logo.opf.json', 'logo.pptx']).report;
  assert.equal(logoExport.ok, true);
  const logoNames = zipNames(await read('logo.pptx'));
  assert.ok(logoNames.some(name => name.endsWith('.svg')), 'the SVG picture is native');
  assert.ok(logoNames.some(name => /media\/image.*\.png$/.test(name)), 'native SVG carries a PNG fallback');

  // A .pptx input: back to OPF; text survives the round trip. Reflow notes are warnings the library reports for wrapped native
  // text, so the round trip itself is not run under --fail-on warning.
  const imported = run(['convert', 'deck.pptx', 'back.opf.json']).report;
  assert.equal(imported.ok, true); assert.equal(imported.written, true);
  assert.equal(await realpath(imported.outputs[0].file), await realpath(path.join(temp, 'back.opf.json')));
  assert.equal(imported.outputs[0].sha256, sha(await read('back.opf.json')));
  assert.equal(imported.input.sha256, sha(await read('deck.pptx')));
  const back = JSON.parse(await read('back.opf.json'));
  assert.deepEqual(back.slides.map(slide => slide.title), ['Quarterly review', 'Priorities', 'Thank you']);
  assert.equal(run(['validate', 'back.opf.json']).report.valid, true);
  run(['convert', 'deck.pptx', 'back.opf.json'], {status: 1});
  assert.equal(run(['convert', 'deck.pptx', 'back.opf.json', '--force']).report.outputs[0].sha256, imported.outputs[0].sha256, 'deterministic import');
  const stdoutDoc = run(['convert', 'deck.pptx', '-', '--to', 'json']);
  assert.equal(JSON.parse(stdoutDoc.raw).slides.length, 3); assert.equal(stdoutDoc.stderrJson.written, true);
  run(['convert', '-', 'stdin.opf.json', '--from', 'pptx'], {input: await read('deck.pptx')});
  await writeFile(path.join(temp, 'not.pptx'), 'not a zip');
  const broken = run(['convert', 'not.pptx', 'broken.opf.json'], {status: 1}).report;
  assert.equal(broken.ok, false); assert.ok(broken.counts.error > 0); assert.equal((await readdir(temp)).includes('broken.opf.json'), false);
  run(['convert', 'missing.pptx', 'x.opf.json'], {status: 2}); run(['convert', 'deck.pptx', 'back.opf.json', '--signals', '-'], {status: 2});
  const strictImport = run(['convert', 'deck.pptx', 'strict.opf.json', '--fail-on', 'warning'], {status: imported.counts.warning ? 1 : 0});
  assert.equal(existsSync(path.join(temp, 'strict.opf.json')), imported.counts.warning === 0);
  void strictImport;
  // Raw signals (`fromPptx(bytes, {signals: true})`): written beside the document, which they do not change.
  const signalsReport = run(['convert', 'deck.pptx', 'signals.opf.json', '--signals', 'signals.json']).report;
  const signalsOutput = signalsReport.outputs.find(item => item.file.endsWith('signals.json'));
  assert.equal(signalsOutput.sha256, sha(await read('signals.json'))); assert.equal(JSON.parse(await read('signals.json')).slides.length, 3);
  assert.equal(signalsOutput.signals, JSON.parse(await read('signals.json')).version, 'the report names the signals format version');
  assert.deepEqual(JSON.parse(await read('signals.opf.json')), back, 'signals do not change the document');
  // A .pptx straight to PDF: imported, then drawn.
  assert.equal(run(['convert', 'deck.pptx', 'from-pptx.pdf']).report.outputs[0].pages, 3);

  // FA-08: per-slide output and PDF skip hidden slides unless --include-hidden; slides named with --slides are always written.
  const hiddenDeck = {name: 'Hidden test', slides: [{id: 'h1', title: 'Shown one'}, {id: 'h2', title: 'Backup slide', hidden: true}, {id: 'h3', title: 'Shown two'}]};
  await writeFile(path.join(temp, 'hidden.opf.json'), JSON.stringify(hiddenDeck));
  const skipped = run(['convert', 'hidden.opf.json', 'hid-default/Hidden-test.svg']).report;
  assert.deepEqual(skipped.outputs.map(item => item.slide), [1, 3], 'hidden slide 2 is not drawn'); assert.deepEqual(skipped.skippedHidden, [2]);
  assert.deepEqual((await readdir(path.join(temp, 'hid-default'))).sort(), ['Hidden-test-1.svg', 'Hidden-test-3.svg'], 'file numbers stay the slide numbers');
  const included = run(['convert', 'hidden.opf.json', 'hid-all/Hidden-test.svg', '--include-hidden']).report;
  assert.deepEqual(included.outputs.map(item => item.slide), [1, 2, 3]); assert.deepEqual(included.skippedHidden, []);
  assert.deepEqual(run(['convert', 'hidden.opf.json', 'hid-named.svg', '--slides', '2']).report.outputs.map(item => item.slide), [2], 'a named hidden slide is written');
  assert.equal(run(['convert', 'hidden.opf.json', 'hid-default.pdf']).report.outputs[0].pages, 2, 'the PDF skips the hidden slide');
  assert.equal(run(['convert', 'hidden.opf.json', 'hid-all.pdf', '--include-hidden']).report.outputs[0].pages, 3);
  run(['convert', 'hidden.opf.json', 'hid-zip.zip', '--scale', '0.25']);
  assert.deepEqual(zipNames(await read('hid-zip.zip')), ['hid-zip-1.png', 'hid-zip-3.png'], 'the zip skips the hidden slide');
  run(['convert', 'hidden.opf.json', 'hid.pptx', '--include-hidden'], {status: 2});
  run(['convert', 'hidden.opf.json', 'hid.pptx']);
  await writeFile(path.join(temp, 'allhidden.opf.json'), JSON.stringify({name: 'All hidden', slides: [{title: 'One', hidden: true}, {title: 'Two', hidden: true}]}));
  const none = run(['convert', 'allhidden.opf.json', 'all-hidden/all.svg'], {status: 1});
  assert.match(none.stderrJson.error, /Every slide is hidden/);
  assert.equal(run(['convert', 'allhidden.opf.json', 'all-hidden/all.svg', '--include-hidden']).report.outputs.length, 2);

  // Fonts and options: bad inputs are usage errors.
  run(['convert', 'deck.opf.json', 'f.svg', '--fonts', 'does-not-exist'], {status: 2});
  await mkdir(path.join(temp, 'empty-fonts'));
  run(['convert', 'deck.opf.json', 'f.svg', '--fonts', 'empty-fonts'], {status: 2});
  run(['convert', 'deck.opf.json', 'f.svg', '--date', '2026-02-30'], {status: 2});

  // opf doctor sees the installed peers.
  const doctor = run(['doctor']).report;
  assert.equal(doctor.formats.svg.ready, true, JSON.stringify(doctor.formats.svg));
  assert.equal(doctor.formats['pptx-import'].ready, true);

  // Optional peers: without them the commands explain what to install and exit 2; everything else keeps working.
  const isolated = await mkdtemp(path.join(tmpdir(), 'opf-files-isolated-'));
  try {
    // The CLI's own files and the one core it depends on, in a tree that has neither opf-render nor opf-pptx anywhere above it.
    const lone = path.join(isolated, 'dist', path.basename(executable));
    await cp(path.dirname(executable), path.join(isolated, 'dist'), {recursive: true});
    // A copy of core, not a link: the workspace core has the peers as devDependencies, and core loads them from its own location.
    await installIsolatedCore(path.join(isolated, 'node_modules'));
    for (const args of [['convert', path.join(temp, 'deck.opf.json'), 'x.svg'], ['convert', path.join(temp, 'deck.opf.json'), 'x.pdf'], ['convert', path.join(temp, 'deck.pptx'), 'x.opf.json']]) {
      const missing = run(args, {status: 2, cwd: isolated, bin: lone});
      assert.equal(missing.stderrJson.code, 'peer-not-installed'); assert.match(missing.stderrJson.install, /^npm install @openpresentation\/opf-(render|pptx)@/);
      assert.ok(missing.stderrJson.error.includes(missing.stderrJson.install), 'the message carries the one install command');
    }
    assert.equal(run(['validate', path.join(temp, 'deck.opf.json')], {cwd: isolated, bin: lone}).report.valid, true);
  } finally {await rm(isolated, {recursive: true, force: true});}
  console.log(`opf convert passed ${checks} drawing checks: SVG, PNG, PDF, PPTX, zip, .pptx input round trip, --fail-on, assets, determinism.`);
} finally {await rm(temp, {recursive: true, force: true});}
