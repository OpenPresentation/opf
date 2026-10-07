// RR-55: the PDF export applies the SVG's font license rule. Real Chromium, the renderer's real browser fonts handle and its real
// export-browser PDF converter. A deck drawn in Roboto is exported to PDF twice: with the registry as it is (Roboto is OFL, so it is
// embedded), and with Roboto's license text replaced by a proprietary one (so it must not be embedded in the PDF). In the second case the
// export cannot write the PDF and says why (`export-fonts-unlicensed`); and with only Roboto Bold dropped the PDF is still written, with
// the regular face standing in for the bold text, reported by the converter and by `export-font-license`. A face whose license failed is
// never embedded.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { loadFonts as loadNodeFonts } from '@openpresentation/opf-render/fonts-node';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(repo, 'artifacts/export-license');
await mkdir(output, { recursive: true });
const node = await loadNodeFonts({ pack: 'office' });
const faces = node.registry.embeddedFonts.filter((face) => face.family === 'Roboto' && [400, 700].includes(face.weight) && !face.italic);
assert.equal(faces.length, 2);
await build({
  stdin: {
    resolveDir: repo, loader: 'js',
    contents: `
import { exportDeck } from ${JSON.stringify(path.join(repo, 'src/export.js').replace(/\\/g, '/'))};
import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
window.run = async ({ faces, licenses = {} }) => {
  const fonts = await loadFonts({ faces: faces.map((face) => ({ ...face, ...(licenses[face.weight] ? { license: licenses[face.weight] } : {}), data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), (c) => c.charCodeAt(0)) })), substitutionPolicy: 'visual', fallbackFamily: 'Roboto' });
  const deck = { name: 'License', design: { fontScheme: 'roboto' }, slides: [{ id: 'a', title: 'Quarterly review', text: 'Revenue grew in every region.' }] };
  const seen = { fontData: undefined };
  const real = await import('@openpresentation/opf-render/export-browser');
  const convert = { svgToPng: real.svgToPng, svgToPdf: (svgs, options) => { seen.fontData = (options.fontData ?? []).map((item) => item.family); seen.handle = 'fonts' in options; return real.svgToPdf(svgs, options); } };
  try {
    const result = await exportDeck(deck, { format: 'pdf', fonts, convert });
    return { bytes: Array.from(result.download.bytes), diagnostics: result.diagnostics, fontData: seen.fontData, handlePassed: seen.handle };
  } catch (error) {
    return { error: { code: error.code, message: error.message, cause: error.cause?.message }, fontData: seen.fontData };
  } finally {
    fonts.dispose();
  }
};`,
  },
  outfile: path.join(output, 'harness.js'), bundle: true, platform: 'browser', format: 'esm', logLevel: 'error',
});
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><meta charset="utf-8"><title>PDF licenses</title><script type="module" src="./harness.js"></script>'); return; }
  if (url.pathname === '/harness.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(await readFile(path.join(output, 'harness.js'))); return; }
  res.writeHead(url.pathname === '/favicon.ico' ? 204 : 404).end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const pdfInfo = async (bytes) => {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, verbosity: 0, useSystemFonts: false }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
  const fontNames = new Set();
  await page.getOperatorList();
  for (const item of content.items) if (item.fontName) fontNames.add(page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName).name : item.fontName);
  return { text, fontNames: [...fontNames] };
};

let browser;
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
  const tab = await browser.newPage();
  const problems = [];
  tab.on('pageerror', (error) => problems.push(error.message));
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForFunction(() => window.run);

  // 1. A permissive face is embedded in the PDF.
  const open = await tab.evaluate((faces) => window.run({ faces }), faces);
  assert.equal(open.handlePassed, false, 'the handle is not handed to the PDF converter');
  assert.ok(open.fontData.includes('Roboto'), 'Roboto (OFL) is given to the PDF converter');
  assert.equal(open.diagnostics.filter((item) => item.code === 'export-font-license').length, 0);
  assert.ok(open.diagnostics.some((item) => item.code === 'pdf-font-embedded' && /Roboto/i.test(item.message)), 'the converter embedded Roboto: ' + JSON.stringify(open.diagnostics.map((item) => item.code)));
  const openPdf = await pdfInfo(open.bytes);
  assert.match(openPdf.text, /Quarterly review/);

  // 2. Every face of the family fails the rule: nothing is given to the converter and the PDF is refused, with the reason.
  const bad = 'All rights reserved. Commercial.';
  const none = await tab.evaluate((args) => window.run(args), { faces, licenses: { 400: bad, 700: bad } });
  assert.deepEqual(none.fontData, [], 'no face with a non-permissive license reaches the PDF converter');
  assert.equal(none.error?.code, 'export-fonts-unlicensed', JSON.stringify(none.error));
  assert.match(none.error.message, /Roboto 400, Roboto 700 are not embedded because the license is not one of OFL-1\.1, Apache-2\.0, MIT or UFL-1\.0/);
  assert.match(none.error.cause, /No embeddable font face/, "the converter's own error is kept as the cause");

  // 3. Only the bold face fails: the PDF is written, the bold face is not in it, the regular face stands in and both say so.
  const some = await tab.evaluate((args) => window.run(args), { faces, licenses: { 700: bad } });
  assert.deepEqual(some.fontData, ['Roboto'], 'only the permissive face reaches the PDF converter');
  const notes = some.diagnostics.filter((item) => item.code === 'export-font-license');
  assert.deepEqual(notes.map((item) => item.message), ['Roboto 700 is not embedded: its license is not one of OFL-1.1, Apache-2.0, MIT or UFL-1.0.']);
  const embeddedNames = some.diagnostics.filter((item) => item.code === 'pdf-font-embedded').map((item) => `${item.family} ${item.weight}`);
  assert.ok(!embeddedNames.some((text) => /\b700\b/.test(text)), 'no 700 face is embedded: ' + JSON.stringify(embeddedNames));
  const somePdf = await pdfInfo(some.bytes);
  assert.match(somePdf.text, /Quarterly review/, 'the bold title text is still in the PDF');
  console.log('PDF license rule (browser): permissive faces embedded (' + openPdf.fontNames.join(', ') + '); all dropped -> export-fonts-unlicensed; bold dropped -> PDF written, regular standing in; converter notes: ' + JSON.stringify([...new Set(some.diagnostics.map((item) => `${item.code}:${item.severity}`))]));
  assert.deepEqual(problems, []);
} finally {
  await browser?.close();
  server.close();
}
