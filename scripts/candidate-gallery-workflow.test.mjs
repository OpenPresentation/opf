import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
test('candidate and control lanes keep exact metadata, immutable browser, and required status boundaries',()=>{
 const candidate=read('.github/workflows/candidate-gallery-qualification.yml'),control=read('.github/workflows/published-gallery-control.yml');
 for(const source of [candidate,control]){
  assert.match(source,/playwright:v1\.63\.0-noble@sha256:[0-9a-f]{64}/);
  assert.match(source,/contents: read/);assert.match(source,/persist-credentials: false/);
  assert.ok(source.indexOf('npm install --global npm@11.16.0')<source.indexOf('npm ci --prefix'));
 }
 assert.match(candidate,/pnpm check:breaking/);assert.match(candidate,/candidate-gallery-build\.mjs/);
 assert.match(control,/candidate-gallery-control\.mjs stage tools opf/);
 assert.match(control,/candidate-gallery-control\.mjs verify tools opf/);
 assert.match(control,/inputs\.cli-ref/);assert.match(control,/cli-source\/packages\/cli\/package\.json/);
 assert.match(control,/node packages\/cli\/test\/packed\.mjs --registry/);
 const ecosystem=read('.github/workflows/ecosystem-ci.yml');
 const portability=ecosystem.slice(ecosystem.indexOf('  installed-portability:'),ecosystem.indexOf('  # RR-53:',ecosystem.indexOf('  installed-portability:')));
 assert.doesNotMatch(portability,/^    if: needs\.gallery\.outputs\.candidate_gallery == ''/m);
 assert.match(portability,/needs\.gallery\.outputs\.candidate_gallery != '' \|\| github\.event_name/);
 assert.match(portability,/candidate-gallery-build\.mjs/);assert.match(portability,/test-packed-ecosystem\.mjs/);
 assert.match(ecosystem,/needs: \[gallery, ecosystem-render, ecosystem-pptx-editor, ecosystem-core, candidate, control, installed-portability\]/);
});
test('supported engines and CLI portability use fresh candidate staging and preserve original contracts',()=>{
 for(const file of ['engines-range.yml','cli-windows.yml']){
  const source=read(`.github/workflows/${file}`);
  assert.match(source,/candidate-gallery\.mjs resolve/);assert.match(source,/uses: \.\/\.github\/actions\/candidate-gallery-stage/);
  assert.match(source,/if: steps\.gallery\.outputs\.candidate_gallery == ''/);
  assert.match(source,/test:cli:packed:peers/);
 }
 const stage=read('.github/actions/candidate-gallery-stage/action.yml');
 assert.ok(stage.indexOf('npm install --global npm@11.16.0')<stage.indexOf('npm ci --prefix'));
 assert.match(stage,/fetch-depth: 0/);assert.match(stage,/persist-credentials: false/);
 assert.match(stage,/candidate-gallery-build\.mjs/);
 for(const file of ['npm-publish.yml','cli-publish.yml']){
  const source=read(`.github/workflows/${file}`);assert.ok(source.indexOf('candidate-gallery.mjs publication')<source.indexOf('pnpm install --frozen-lockfile'));
 }
});

test('sibling published control selects the core tools repository/ref with an unchanged core default',()=>{
 const control=read('.github/workflows/published-gallery-control.yml');
 assert.match(control,/tools-ref:\s+type: string\s+required: false\s+default: ''/);
 const checkout=control.slice(control.indexOf('    steps:'),control.indexOf('          path: opf\n'));
 assert.match(checkout,/repository: OpenPresentation\/opf\s+ref: \$\{\{ inputs\.tools-ref \|\| github\.sha \}\}\s+fetch-depth: 0\s+path: tools/);
 assert.match(checkout,/persist-credentials: false/);
 assert.match(control,/TOOLS_REF: \$\{\{ inputs\.tools-ref \|\| github\.sha \}\}/);
 assert.match(control,/assert\.match\(process\.env\.TOOLS_REF,\/\^\[0-9a-f\]\{40\}\$\//);
 assert.match(control,/rev-parse','HEAD'/);
});
