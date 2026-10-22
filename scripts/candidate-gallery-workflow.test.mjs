import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
// Apply the same strict contracts to both LF and Windows CRLF checkout bytes.
for(const ending of ['LF','CRLF']){
const read=file=>{
 const original=readFileSync(new URL(`../${file}`,import.meta.url),'utf8').replaceAll('\r\n','\n');
 const checkedOut=ending==='CRLF'?original.replaceAll('\n','\r\n'):original;
 return checkedOut.replaceAll('\r\n','\n');
};
test(ending+': '+'candidate and control lanes keep exact metadata, immutable browser, and required status boundaries',()=>{
 const candidate=read('.github/workflows/candidate-gallery-qualification.yml'),control=read('.github/workflows/published-gallery-control.yml');
 // Candidate engines advance together; the independent control installs the published set in
 // release-plan.json, whose renderer (0.24.3) runs Playwright 1.64.0.
 assert.match(candidate,/playwright:v1\.64\.0-noble@sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f/);
 assert.match(control,/playwright:v1\.64\.0-noble@sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f/);
 for(const source of [candidate,control]){
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
 assert.match(portability,/needs\.gallery\.outputs\.candidate_gallery != '' \|\| \(?github\.event_name/);
 assert.match(portability,/candidate-gallery-build\.mjs/);assert.match(portability,/test-packed-ecosystem\.mjs/);
 assert.match(ecosystem,/needs: \[gallery, ecosystem-render, ecosystem-pptx, ecosystem-editor, ecosystem-core, candidate, control, installed-portability\]/);
});
test(ending+': '+'supported engines and CLI portability use fresh candidate staging and preserve original contracts',()=>{
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
 for(const file of ['cli-publish.yml']){ // MR-40: npm-publish.yml is the monorepo publisher and has no candidate gallery
  const source=read(`.github/workflows/${file}`);assert.ok(source.indexOf('candidate-gallery.mjs publication')<source.indexOf('pnpm install --frozen-lockfile'));
 }
});

test(ending+': '+'sibling published control selects the core tools repository/ref with an unchanged core default',()=>{
 const control=read('.github/workflows/published-gallery-control.yml');
 assert.match(control,/tools-ref:\s+type: string\s+required: false\s+default: ''/);
 const checkout=control.slice(control.indexOf('    steps:'),control.indexOf('          path: opf\n'));
 assert.match(checkout,/repository: OpenPresentation\/opf\s+ref: \$\{\{ inputs\.tools-ref \|\| github\.sha \}\}\s+fetch-depth: 0\s+path: tools/);
 assert.match(checkout,/persist-credentials: false/);
 assert.match(control,/TOOLS_REF: \$\{\{ inputs\.tools-ref \|\| github\.sha \}\}/);
 assert.match(control,/assert\.match\(process\.env\.TOOLS_REF,\/\^\[0-9a-f\]\{40\}\$\//);
 assert.match(control,/rev-parse','HEAD'/);
});

test(ending+': '+'installed candidate staging primes gallery engines before strict source linking',()=>{
 const workflow=read('.github/workflows/ecosystem-ci.yml');
 const job=workflow.slice(workflow.indexOf('  installed-portability:'),workflow.indexOf('  # RR-53:',workflow.indexOf('  installed-portability:')));
 for(const command of ['pnpm build','node scripts/link-ecosystem.mjs --packages-only']){
  const step=job.slice(job.indexOf(`      - run: ${command}\n`)).split('\n      - ')[0];
  assert.ok(step.includes("if: steps.scope.outputs.run == 'true' && needs.gallery.outputs.candidate_gallery == ''"),'ordinary build/link cannot run before candidate closure priming');
 }
 assert.match(job,/Stage and qualify the exact six-package candidate graph\n        if: steps\.scope\.outputs\.run == 'true' && needs\.gallery\.outputs\.candidate_gallery != ''\n        run: node scripts\/candidate-gallery-build\.mjs/);
 const build=read('scripts/candidate-gallery-build.mjs');
 assert.ok(build.indexOf("symlinkSync(source,target,process.platform")<build.indexOf("run('node',['scripts/link-ecosystem.mjs','--packages-only'])"));
 assert.match(read('scripts/link-ecosystem.mjs'),/await assertSingleCore/,'strict one-core guard remains');
 assert.match(job,/node scripts\/pack-ecosystem\.mjs/);assert.match(job,/node scripts\/test-packed-ecosystem\.mjs/);
});

test(ending+': '+'engines range retains complete contracts within a bounded candidate graph budget',()=>{
 const source=read('.github/workflows/engines-range.yml');
 const node=source.slice(source.indexOf('  node-range:'));
 assert.match(node,/timeout-minutes: 45/);
 assert.match(node,/node: \[22, 26\]/);
 for(const command of ['pnpm test','node packages/javascript/test/packed-install-smoke.mjs','pnpm test:cli:packed','pnpm test:cli:packed:peers'])assert.ok(node.includes(`run: ${command}\n`),command);
 assert.match(read('packages/cli/test/packed-files.mjs'),/timeout: 600000/,'individual install/command hangs remain bounded');
});

test(ending+': '+'installed and CLI portability retain registry controls within their bounded graph budget',()=>{
 const ecosystem=read('.github/workflows/ecosystem-ci.yml');
 const installed=ecosystem.slice(ecosystem.indexOf('  installed-portability:'),ecosystem.indexOf('  # RR-53:',ecosystem.indexOf('  installed-portability:')));
 const cli=read('.github/workflows/cli-windows.yml').slice(read('.github/workflows/cli-windows.yml').indexOf('  cli:'));
 for(const job of [installed,cli]){
  assert.match(job,/timeout-minutes: 45/);assert.match(job,/os: \[windows-latest, macos-latest\]/);
  for(const command of ['pnpm test:cli:packed','pnpm test:cli:packed:peers','node packages/cli/test/packed.mjs --registry'])assert.ok(job.includes(command),command);
  assert.match(job,/CANDIDATE_GALLERY_REF: ''/,'actual published control remains distinct');
 }
});

}
