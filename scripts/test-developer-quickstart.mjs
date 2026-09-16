import assert from 'node:assert/strict';
import {execFile as execFileCallback} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {packageManagerInvocation} from './package-manager.mjs';

const execFile = promisify(execFileCallback);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = JSON.parse(await readFile(path.join(root, 'release-plan.json'), 'utf8'));
const deckSource = path.join(root, 'examples/developer-quickstart/developer-quickstart.opf.json');

assert.ok(
  !process.env.NODE_OPTIONS && !process.execArgv.some((arg) => /^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(arg)),
  'Registry quickstart verification must not use source loaders or module aliases',
);

async function run(command, args, options = {}) {
  try {
    if (command === 'npm') ({command, args} = packageManagerInvocation(command, args));
    return await execFile(command, args, {maxBuffer: 10 * 1024 * 1024, ...options});
  } catch (error) {
    const stdout = error.stdout ? `\nstdout:\n${error.stdout}` : '';
    const stderr = error.stderr ? `\nstderr:\n${error.stderr}` : '';
    error.message = `${error.message}${stdout}${stderr}`;
    throw error;
  }
}

const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'opf-developer-quickstart-'));
const projectDir = path.join(tmpRoot, 'project');

try {
  await mkdir(projectDir, {recursive: true});
  await writeFile(
    path.join(projectDir, 'package.json'),
    `${JSON.stringify({private: true, type: 'module'}, null, 2)}\n`,
  );
  await copyFile(deckSource, path.join(projectDir, 'deck.opf.json'));
  const originalDeck = await readFile(path.join(projectDir, 'deck.opf.json'));
  const originalSlides = JSON.parse(originalDeck.toString('utf8')).slides.length;

  const specs = plan.packages.map((item) => `${item.name}@${item.version}`);
  await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...specs], {cwd: projectDir});

  const lock = JSON.parse(await readFile(path.join(projectDir, 'package-lock.json'), 'utf8'));
  for (const item of plan.packages) {
    const entry = lock.packages[`node_modules/${item.name}`];
    assert.equal(entry?.version, item.version, `${item.name} must install ${item.version}`);
    assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/'), `${item.name} must resolve from the npm registry`);
    assert.ok(!entry.link, `${item.name} must not be a linked workspace package`);
    assert.match(entry.integrity, /^sha512-/);
  }

  await writeFile(path.join(projectDir, 'workflow.mjs'), `import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {validatePresentation, lintSource, composeSlide, paginatePresentation, fontSchemes, resolveFontFamilies} from '@openpresentation/opf';
import {createEditorSession} from '@openpresentation/opf-editor';
import {prepareNodeFonts} from '@openpresentation/opf-render/fonts-node';
import {renderSvgDeck, svgToPng, svgToPdf} from '@openpresentation/opf-render';
import {toPptx} from '@openpresentation/opf-pptx';

const source = await readFile('deck.opf.json', 'utf8');
const document = JSON.parse(source);
const validation = validatePresentation(document);
assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
const lint = lintSource(source);
assert.equal(lint.valid, true, JSON.stringify(lint.diagnostics, null, 2));

const {registry, options} = await prepareNodeFonts({pack: 'base'});
assert.ok((registry.embeddedFonts?.length ?? 0) >= 1, 'bundled Roboto faces must be available offline');
const fonts = resolveFontFamilies(fontSchemes.find((scheme) => scheme.id === 'roboto'));
assert.equal(fonts.body, 'Roboto');

const geometry = composeSlide(document.slides[0], {presentation: document, fonts, ...options});
assert.deepEqual(geometry.diagnostics, []);
assert.equal(geometry.furniture.algorithm, 'furniture-flow-v2');
assert.ok(geometry.furniture.headerBottom > 0);
assert.ok(geometry.contentBox.y >= geometry.furniture.headerBottom);
assert.ok(geometry.contentBox.y + geometry.contentBox.height <= geometry.furniture.footerTop);

const {presentation, pages} = paginatePresentation(document, {fonts, ...options, minFontSize: 32});
assert.equal(validatePresentation(presentation).valid, true);
assert.ok(pages.length >= 2, 'dense overflow slide must paginate into more than one page');
assert.ok(presentation.slides.every((slide) => typeof slide.title === 'string' && slide.title.length > 0));

const editor = createEditorSession(document, {rejectInvalid: true});
const originalTitle = editor.document.slides[3].title;
assert.equal(originalTitle, 'Next  steps');
editor.set('slides.3.title', 'Edited title');
assert.equal(editor.document.slides[3].title, 'Edited title');
assert.equal(editor.canUndo, true);
editor.undo();
assert.equal(editor.document.slides[3].title, originalTitle);

const svgs = renderSvgDeck(presentation, options);
assert.ok(svgs.length >= 2);
assert.match(svgs[0], /Install published OPF packages/);
assert.match(svgs[0], /Developer  quickstart/);
const png = await svgToPng(svgs[0], options);
assert.ok(png.length > 1000);
const pdf = await svgToPdf(svgs, options);
assert.ok(pdf.length > 1000);
const pptx = await toPptx(presentation, options);
assert.ok(pptx.length > 1000);
await writeFile('preview.svg', svgs[0]);
await writeFile('preview.png', png);
await writeFile('preview.pdf', pdf);
await writeFile('deck.pptx', pptx);
console.log(JSON.stringify({
  slidesIn: document.slides.length,
  slidesOut: presentation.slides.length,
  pages: pages.length,
  fonts: registry.embeddedFonts.length,
  svgChars: svgs[0].length,
  pngBytes: png.length,
  pdfBytes: pdf.length,
  pptxBytes: pptx.length,
}, null, 2));
`);

  await run(process.execPath, ['workflow.mjs'], {cwd: projectDir});

  const cli = path.join(projectDir, 'node_modules', '@openpresentation', 'cli', 'dist', 'index.js');
  const version = await run(process.execPath, [cli, '--version'], {cwd: projectDir});
  const versionReport = JSON.parse(version.stdout);
  assert.equal(versionReport.cli, '0.8.1');
  assert.equal(versionReport.opf, '0.10.1');
  const validated = await run(process.execPath, [cli, 'validate', 'deck.opf.json'], {cwd: projectDir});
  assert.equal(JSON.parse(validated.stdout).valid, true);
  const linted = await run(process.execPath, [cli, 'lint', 'deck.opf.json'], {cwd: projectDir});
  assert.equal(JSON.parse(linted.stdout).valid, true);
  await run(process.execPath, [cli, 'paginate', 'deck.opf.json', 'paginated.opf.json'], {cwd: projectDir});
  const paginated = JSON.parse(await readFile(path.join(projectDir, 'paginated.opf.json'), 'utf8'));
  assert.ok(paginated.slides.length >= originalSlides);

  const after = await readFile(path.join(projectDir, 'deck.opf.json'));
  assert.equal(
    createHash('sha256').update(after).digest('hex'),
    createHash('sha256').update(originalDeck).digest('hex'),
  );
  console.log('developer quickstart: published registry install passed');
} finally {
  await rm(tmpRoot, {recursive: true, force: true});
}
