import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const workflow=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
const jobs=workflow.split(/\n(?=  [a-z][a-z-]*:\n)/).slice(1);
const sources=jobs.filter(job=>/^  (package|node-range|macos-playground):/.test(job));

test('candidate jobs fail rather than skip-green when selection or control fails',()=>{
  assert.ok(sources.length>=2);
  for(const job of sources){
    assert.match(job,/needs: \[candidate-selection, published-control\]/);
    assert.match(job,/if: \$\{\{ always\(\) &&/);
    assert.match(job,/test "\$SELECTION" = success\n          if \[ -n "\$GALLERY" \]; then test "\$CONTROL" = success; fi/);
  }
  const gate='test "$SELECTION" = success\nif [ -n "$GALLERY" ]; then test "$CONTROL" = success; fi';
  for(const [selection,gallery,control,ok] of [
    ['success','','skipped',true],['failure','','skipped',false],
    ['success','reviewed','success',true],['success','reviewed','failure',false],
    ['success','reviewed','skipped',false],['cancelled','reviewed','success',false],
  ]){
    const result=spawnSync('bash',['-e','-c',gate],{env:{...process.env,SELECTION:selection,GALLERY:gallery,CONTROL:control}});
    assert.equal(result.status===0,ok,`${selection}/${gallery}/${control}`);
  }
});
test('source jobs preserve frozen install ordering and exact authorization before staging',()=>{
  for(const job of sources){
    const install=job.indexOf('npm ci --prefix "$repo"');
    const authorize=job.indexOf('uses: ./opf/.github/actions/candidate-gallery');
    const stage=job.indexOf('node scripts/candidate-gallery-build.mjs');
    assert.ok(install>=0&&install<authorize&&authorize<stage);
    assert.match(job,/test "\$GALLERY" = "\$LINKED_GALLERY"/);
    assert.match(job,/else\n            pnpm build\n            node scripts\/link-ecosystem.mjs --packages-only\n          fi/);
    assert.match(job,/ref: \$\{\{ needs.candidate-selection.outputs.opf \}\}/);
    const buildStep=job.slice(job.indexOf("      - name: Build and link coordinated sources"),job.indexOf("      - name: Build and link coordinated sources")+650);
    assert.doesNotMatch(buildStep,/continue-on-error:/);
  }
  assert.match(workflow,/GITHUB_TOKEN: \$\{\{ github.token \}\}/);
  assert.match(workflow,/run: node scripts\/candidate-gallery.mjs resolve/);
  assert.doesNotMatch(workflow,/GITHUB_EVENT_NAME:|GITHUB_REPOSITORY:|secrets: inherit/);
  // The canonical resolver is the tested PR/queue/live-body and tag-refusal boundary.
  assert.match(workflow,/consumer: opf-(?:render|pptx|editor)/);
  assert.match(workflow,/permissions:\n  contents: read/);
});
test('ordinary packing is preserved and candidate no-repack requires authenticated artifacts',()=>{
  const packed=sources.filter(job=>job.includes('pnpm pack:ecosystem'));
  assert.equal(packed.length,1);
  assert.match(packed[0],/if \[ -n "\$CANDIDATE_GALLERY_REF" \]; then\n            node --input-type=module -e .*assert.ok\(candidateArtifacts\(process.cwd\(\)\)\)/);
  assert.match(packed[0],/else\n            pnpm pack:ecosystem\n          fi\n          pnpm test:packed-ecosystem\n          pnpm test:packed-browser/);
});
test('published control binds its own selected tools and every published graph input',()=>{
  const control=jobs.find(job=>job.startsWith('  published-control:'));
  assert.ok(control);
  assert.match(control,/published-gallery-control.yml@[0-9a-f]{40}/);
  assert.match(control,/tools-ref: \$\{\{ needs.candidate-selection.outputs.opf \}\}/);
  for(const field of ['opf','opf_render','opf_pptx','opf_editor','cli'])assert.ok(control.includes(`needs.candidate-selection.outputs.published_${field}`));
});
