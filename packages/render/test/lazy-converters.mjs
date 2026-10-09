// RR-63: the PDF/PNG converters (pdf-lib, @resvg/resvg-js, sharp) and the @expo-google-fonts packages are optional peers, loaded on first use.
// An isolated copy of dist with only the hard dependencies proves: SVG output and the vector PDF of text and shapes need none of them; an export
// that does need one rejects with `OPFRenderError` code `converter-missing` naming the package to install; a font pack names every missing
// font package at once; and the `/png` and `/pdf` entries resolve from the package. Offline and deterministic.
import assert from 'node:assert/strict';
import {cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const link = (name, into) => symlink(path.join(root, 'node_modules', name), path.join(into, 'node_modules', name), process.platform === 'win32' ? 'junction' : 'dir');

// The metadata: nothing heavy is a runtime dependency; every optional piece is an optional peer, installed for tests.
for (const name of ['pdf-lib', '@resvg/resvg-js', 'sharp']) {
  assert.equal(pkg.dependencies[name], undefined, `${name} is not a runtime dependency`);
  assert.equal(pkg.peerDependenciesMeta[name]?.optional, true, `${name} is an optional peer`);
  assert.ok(pkg.devDependencies[name], `${name} is installed for tests`);
}
assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@openpresentation/opf', 'bidi-js', 'fontkit', 'harfbuzzjs', 'pako']);

// The subpaths resolve from the package itself and are the same functions as the root's.
const rootApi = await import('@openpresentation/opf-render');
assert.equal((await import('@openpresentation/opf-render/png')).toPng, rootApi.toPng);
assert.equal((await import('@openpresentation/opf-render/pdf')).toPdf, rootApi.toPdf);
assert.equal(typeof (await import('@openpresentation/opf-render/svg')).toSvg, 'function');

const temporary = await mkdtemp(path.join(tmpdir(), 'opf-lazy-converters-'));
try {
  await writeFile(path.join(temporary, 'package.json'), JSON.stringify({type: 'module'}));
  await cp(path.join(root, 'dist'), path.join(temporary, 'dist'), {recursive: true});
  await mkdir(path.join(temporary, 'node_modules/@expo-google-fonts'), {recursive: true});
  for (const name of ['fontkit', 'bidi-js', 'pako', 'harfbuzzjs', '@openpresentation']) await link(name, temporary);
  const load = name => import(pathToFileURL(path.join(temporary, 'dist', name)));
  const index = await load('index.js'), fontsNode = await load('fonts-node.js');
  const text = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect width="200" height="100" fill="#ffffff"/><text x="10" y="50" font-family="Roboto" font-size="20">Hello</text></svg>';

  // SVG output needs no converter and no font package: importing the root loads none of them.
  const svgs = index.toSvg({slides: [{title: 'Lean install', text: 'No converters, no font packages.'}]});
  assert.equal(svgs.length, 1);
  assert.match(svgs[0], /^<svg /);

  // Font packages: one error that names every missing package and the install command.
  const roboto = ['@expo-google-fonts/roboto', '@expo-google-fonts/roboto-mono'];
  await assert.rejects(fontsNode.loadFonts(), error => {
    assert.equal(error.name, 'OPFFontError');
    assert.equal(error.code, 'font-resource-unavailable');
    assert.deepEqual(error.details.packages, roboto);
    assert.match(error.message, /'base' font pack/);
    assert.ok(error.message.includes('npm install @expo-google-fonts/roboto@0.4.3 @expo-google-fonts/roboto-mono@0.4.2'), error.message);
    return true;
  });
  await assert.rejects(fontsNode.loadFonts({pack: 'office'}), error => {
    assert.equal(error.code, 'font-resource-unavailable');
    for (const name of [...roboto, '@expo-google-fonts/arimo', '@expo-google-fonts/caladea', '@expo-google-fonts/cousine', '@expo-google-fonts/gelasio', '@expo-google-fonts/tinos', '@expo-google-fonts/noto-sans']) assert.ok(error.details.packages.includes(name), `${name} is named`);
    return true;
  });
  await assert.rejects(fontsNode.loadFonts({pack: 'none', scripts: ['Jpan']}), error => error.code === 'font-resource-unavailable' && error.details.packages.includes('@expo-google-fonts/noto-sans-jp') && /npm install @expo-google-fonts\/noto-sans-jp@/.test(error.message));
  await assert.rejects(fontsNode.loadFonts({pack: 'none'}), {code: 'empty-font-registry'}); // the none pack asks for no font package, only for your faces
  // The default fonts of a conversion are the base pack: the same error, after the converter check.
  await assert.rejects(index.toPdf(text), {code: 'font-resource-unavailable'});

  // Converters: add the base fonts, still no pdf-lib, resvg or sharp.
  for (const name of roboto) await link(name, temporary);
  const converterMissing = (promise, name, install) => assert.rejects(promise, error => {
    assert.equal(error.name, 'OPFRenderError');
    assert.equal(error.code, 'converter-missing');
    assert.equal(error.details.package, name);
    assert.equal(error.details.installed, false);
    assert.ok(error.message.includes(name) && error.message.includes(install), error.message);
    return true;
  });
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const withImage = text.replace('</svg>', `<image x="0" y="0" width="10" height="10" href="data:image/png;base64,${png}"/></svg>`);
  const withFilter = text.replace('</svg>', '<defs><filter id="f"><feGaussianBlur stdDeviation="2"/></filter></defs><rect width="50" height="50" fill="#d03030" filter="url(#f)" data-opf-path="slides.0.shape"/></svg>');
  await converterMissing(index.toPng(text), '@resvg/resvg-js', 'npm install @resvg/resvg-js@^2.6.2');
  // The vector PDF (the default) of text and shapes needs none of the three.
  const pdf = await index.toPdf(text);
  assert.equal(Buffer.from(pdf.subarray(0, 5)).toString('latin1'), '%PDF-');
  const diagnostics = [];
  await index.toPdf([text, text], {onDiagnostic: item => diagnostics.push(item.code)});
  assert.ok(!diagnostics.some(code => code === 'pdf-image-skipped' || code === 'pdf-raster-fallback'));
  // Pictures need sharp (not a silently picture-less PDF), a filter needs resvg, the raster mode needs pdf-lib.
  await converterMissing(index.toPdf(withImage), 'sharp', 'npm install sharp@^0.35.5');
  await converterMissing(index.toPdf(withFilter), '@resvg/resvg-js', 'npm install @resvg/resvg-js@^2.6.2');
  await converterMissing(index.toPdf(text, {raster: true}), 'pdf-lib', 'npm install pdf-lib@^1.17.1');
  // A bad option is still reported before any converter is needed.
  await assert.rejects(index.toPdf(text, {raster: 'tiff'}), {code: 'invalid-conversion-option'});
  await assert.rejects(index.toPdf([]), {code: 'empty-pdf'});

  // With resvg present and sharp absent, a WebP picture asks for sharp instead of reporting a broken image.
  await link('@resvg', temporary);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]).toString('base64');
  await converterMissing(index.toPng(text.replace('</svg>', `<image x="0" y="0" width="10" height="10" href="data:image/webp;base64,${webp}"/></svg>`)), 'sharp', 'npm install sharp@^0.35.5');
  assert.ok((await index.toPng(text)).byteLength > 100, 'with resvg installed the PNG converts');
} finally {
  await rm(temporary, {recursive: true, force: true});
}
console.log('lazy converters: optional peers, converter-missing, font-package errors and the png/pdf subpaths pass');
