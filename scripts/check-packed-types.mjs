import assert from 'node:assert/strict';
import {readFile, writeFile, realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const require = createRequire(new URL('../packages/javascript/package.json', import.meta.url));

// Compile only the isolated installation, with no source aliases or skipLibCheck.
export async function checkPackedTypes(directory, {downstream = false} = {}) {
  const installed = createRequire(path.join(directory, 'package.json'));
  const manifestPath = installed.resolve('@openpresentation/opf/package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (downstream) {
    for (const name of ['@openpresentation/opf-render', '@openpresentation/opf-editor', '@openpresentation/opf-pptx']) {
      const consumer = createRequire(installed.resolve(name));
      assert.equal(await realpath(consumer.resolve('@openpresentation/opf/package.json')), await realpath(manifestPath), `${name} must resolve the candidate core tarball`);
    }
  }
  const entries = Object.entries(manifest.exports).filter(([, target]) => typeof target === 'object');
  for (const [entry, target] of entries) {
    assert.ok(target.types && target.import, `${entry} needs runtime and declaration targets`);
    await readFile(path.resolve(path.dirname(manifestPath), target.types));
  }
  const imports = entries.map(([entry], index) => {
    const specifier = manifest.name + (entry === '.' ? '' : entry.slice(1));
    return `import * as entry${index} from ${JSON.stringify(specifier)}; void entry${index};`;
  }).join('\n');
  await writeFile(path.join(directory, 'types-smoke.ts'), `${imports}
import type {Presentation} from '@openpresentation/opf/types';
import {validatePresentation} from '@openpresentation/opf/validator';
import {composeSlide} from '@openpresentation/opf/composition';
import type {FontFaceSelection, TextStyle} from '@openpresentation/opf/composition';
import {paginatePresentation} from '@openpresentation/opf/pagination';
import {createDataContent} from '@openpresentation/opf/data';
const deck: Presentation = {slides: [{title: 'Typed consumer'}]};
const physicalFace: FontFaceSelection = {family: 'Roboto SemiBold', bold: false, italic: false};
const measuredStyle: TextStyle = {fontFamily: 'Roboto SemiBold', fontWeight: 600, fontFace: physicalFace};
// @ts-expect-error Physical style-link flags are booleans, independent of weight.
const invalidFace: FontFaceSelection = {family: 'Roboto', bold: 600, italic: false};
void measuredStyle; void invalidFace;
const valid: boolean = validatePresentation(deck).valid;
const pages = paginatePresentation(deck).presentation;
composeSlide(pages.slides[0]);
createDataContent('Name,Value\\nA,1', {as: 'table'});
// @ts-expect-error slides must remain an array
const invalid: Presentation = {slides: 42};
// @ts-expect-error unsupported import target must be rejected
createDataContent([], {as: 'unsupported'});
void valid; void invalid;
${downstream ? `
import {renderSvg} from '@openpresentation/opf-render';
import {createEditorSession} from '@openpresentation/opf-editor';
import {toPptx} from '@openpresentation/opf-pptx';
const editor = createEditorSession(deck);
const edited = editor.document;
const svg: string = renderSvg(edited);
toPptx(edited); void svg;
` : ''}
`);
  for (const mode of ['NodeNext', 'Bundler']) {
    await writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {target: 'ES2022', module: mode === 'Bundler' ? 'ESNext' : 'NodeNext', moduleResolution: mode, strict: true, skipLibCheck: false, noEmit: true, types: ['node'], lib: ['ES2022', 'DOM']},
      files: ['types-smoke.ts'],
    }));
    for (const compiler of [require.resolve('typescript/bin/tsc'), fileURLToPath(new URL('./typecheck.mjs', import.meta.url))]) {
      const result = spawnSync(process.execPath, [compiler, '--project', 'tsconfig.json'], {cwd: directory, encoding: 'utf8'});
      if (result.error) throw result.error;
      assert.equal(result.status, 0, `${mode}: ${compiler}\n${result.stdout}\n${result.stderr}`);
    }
  }
  console.log(`Packed TypeScript 5.9/7 consumers passed: ${entries.length} exports, NodeNext/Bundler${downstream ? ', published renderer/editor/PPTX' : ''}.`);
}
