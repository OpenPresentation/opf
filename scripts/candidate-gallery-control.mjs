// Published runtime with explicitly reported reviewed-plan metadata and a narrowly pinned test-tooling bridge.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,lstatSync,realpathSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readRegularJson,publishedGalleryControl} from './candidate-gallery.mjs';
const regularBytes=file=>{const absolute=path.resolve(file);assert.equal(realpathSync(absolute),absolute,'aliased test-tooling file');assert.ok(lstatSync(absolute).isFile(),'nonregular test-tooling file');return readFileSync(absolute);};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const BRIDGE_PATH='scripts/lazy-font-counts.mjs';
export const FONT_COUNT_BRIDGE=Object.freeze({sourceSha:'382ae0102335f536131a6e3659761f8a5240fe4d',originalSha256:'036291922645b9cf0e25e40b4b8dc31ed6d98098b275f3bbfbd00fb34aa7eabb',reviewedSha256:'4bd224521620e8036af161c4e14338d0868019a2dbee36b33fdec9a539ba1b1c'});

// Exact test tooling from the independently qualified final 0.19 registry adoption (#643).
// It never replaces published runtime, manifests, dependency locks or fixture baselines.
export const PUBLISHED_019_SOURCE='b3e306d005d3cd0563964d541a834a8a50469536';
export const PUBLISHED_019_TOOLING=Object.freeze([{"path":"scripts/lazy-font-counts.mjs","sourceSha":"85089bf359a41950e5887d782452dd3884805386","originalSha256":"1dc5e9c5e145439d869fcc557ec3f74984b35eb8bff02eeb3e0552be877ee426","reviewedSha256":"549603abef0f83ce93688adc541eced84ab10b4aaa28324580d339bf67ca35a0"},{"path":"scripts/lazy-font-counts.test.mjs","sourceSha":"85089bf359a41950e5887d782452dd3884805386","originalSha256":"fa45c8a68e150cd654d48c584d8f67fc4091749095d045cd77eadf3b66f3c42a","reviewedSha256":"48862c28f0e25c0b3c2478d9f84edd0f0774111f512abdd26f04403e367ba327"},{"path":"scripts/test-layout-contract-registry.mjs","sourceSha":"85089bf359a41950e5887d782452dd3884805386","originalSha256":"684df604f5bb4d97ba9c75c0b2f16595caa65d9b1194d744e3663d8195c71824","reviewedSha256":"6efd5c564634539e59ec26205085dce2a2a42a6d36841fb43dcb7d575b902a3b"},{"path":"scripts/registry-layout-v2.mjs","sourceSha":"85089bf359a41950e5887d782452dd3884805386","originalSha256":null,"reviewedSha256":"f32eafab2db6b2d1aa36d041d0af2cef02657f2a7ddf7b28f61a465918ac52de"}].map(Object.freeze));
// FA-33 / RR-101: the 0.24.2 published core predates the fix that rebuilds opf-editor's git-ignored `dist/styles.css` from the
// release commit (#769), so its own installed-code check cannot bind the editor 0.24.1+ archive to a release commit, and its
// catalog-generation table (#763) stops at core 0.20 to 0.24 only in later sources. The control runs those helpers (and the test
// of the table) from the tools checkout instead; every byte of the published runtime stays as published.
export const PUBLISHED_0242_SOURCE='e6ade17b4fcaf70bc716654d39102a54db015965';
export const PUBLISHED_0242_TOOLING=Object.freeze([{path:'scripts/test-installed-code.mjs',sourceSha:'8d2f43a9dfb9399be1cd0c66d5373890cc3367c1',originalSha256:'dd713c98b49fe14dca40722424f404d25bb44d2c3e83bcd4d5f80aff1fcfe1b3',reviewedSha256:'6808fd530ec4f9400de53a67e26ecc1024727d54a3eac8b1260134c91537e949'},{path:'scripts/published-matrix/consumer-dependencies.mjs',sourceSha:'8d2f43a9dfb9399be1cd0c66d5373890cc3367c1',originalSha256:'54a93b20d295baaa21163cd14fdd0697cad8ea4ab3653d0159dbea8a6cb8693d',reviewedSha256:'d4c74df425525f48b9dd04e88bb049cbcf521af2c72f6f1ace9d1da49b13a79f'},{path:'scripts/published-matrix/consumer-dependencies.test.mjs',sourceSha:'8d2f43a9dfb9399be1cd0c66d5373890cc3367c1',originalSha256:'60cbdccf6b6e50eab72b74e9f941f6d4965a7b4e045b19236e78584eb5c0b107',reviewedSha256:'4689b8b7efaf168c30d213de6894d0afbd788719c8d744443cb724c6f9ab48e0'},{path:'scripts/published-matrix/browser-fixture.test.mjs',sourceSha:'8d2f43a9dfb9399be1cd0c66d5373890cc3367c1',originalSha256:'f5f8cefcb56cc39f835ce9a5ceba5fb866c139c300f80ec30319a7e7f54a3c62',reviewedSha256:'eed5c2e6cc2361a5f72863a02de64bf51052ffc254cc9cc88cd6e8235ada417d'}]);
function published0242Plan(plan){
 const versions=Object.fromEntries((plan.packages??[]).map(item=>[item.name,item.version]));
 // The published 0.24 core is 0.24.2; the registry `latest` editor is 0.24.2 or 0.24.3 (plan rolled in #769 and FA-33 adoption). Both are built by the
 // same release scripts, so the one reviewed bridge covers each; any other editor is an unknown graph.
 return versions['@openpresentation/opf']==='0.24.2'&&['0.24.2','0.24.3'].includes(versions['@openpresentation/opf-editor']);
}
function published019Plan(plan){
 const renderer=plan.packages?.find(item=>item.name==='@openpresentation/opf-render')?.version;
 if(renderer!=='0.19.1')return false;
 assert.deepEqual(Object.fromEntries(plan.packages.map(item=>[item.name,item.version])),{'@openpresentation/opf':'0.19.0','@openpresentation/opf-render':'0.19.1','@openpresentation/opf-pptx':'0.19.0','@openpresentation/opf-editor':'0.19.0','@openpresentation/cli':'0.19.0'},'unknown published 0.19 control graph');
 assert.equal(plan.independentPackages?.find(item=>item.name==='@openpresentation/gallery')?.version,'2.0.0','published 0.19 control requires actual Gallery2');
 return true;
}
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
export function stagePublishedControlPlan({toolsRoot,coreRoot}){
  const target=path.join(coreRoot,'release-plan.json'),source=path.join(toolsRoot,'release-plan.json');
  const reviewed=readRegularJson(source),original=readRegularJson(target);
  assert.equal(git(coreRoot,'ls-files','--others','--exclude-standard'),'','published source must contain no untracked source files');
  assert.equal(git(coreRoot,'diff','--name-only','HEAD'),'','published source must be clean before metadata staging');
  const originalBytes=readFileSync(target),reviewedBytes=readFileSync(source);
  const record={qualification:'published source/harness with reviewed registry-plan metadata; not an unchanged checkout',sourceSha:git(coreRoot,'rev-parse','HEAD'),originalPlan:original,reviewedPlan:reviewed,originalSha256:digest(originalBytes),reviewedSha256:digest(reviewedBytes)};
  mkdirSync(path.join(coreRoot,'artifacts/published-control'),{recursive:true});
  writeFileSync(path.join(coreRoot,'artifacts/published-control/original-release-plan.json'),originalBytes);
  writeFileSync(path.join(coreRoot,'artifacts/published-control/metadata.json'),`${JSON.stringify(record,null,2)}\n`);
  const renderer=reviewed.packages?.find(item=>item.name==='@openpresentation/opf-render')?.version;
  if(renderer==='0.18.2'){
    const helper=path.join(coreRoot,BRIDGE_PATH),originalHelper=regularBytes(helper);
    if(digest(originalHelper)!==FONT_COUNT_BRIDGE.reviewedSha256){
      assert.equal(digest(originalHelper),FONT_COUNT_BRIDGE.originalSha256,'published test helper differs from the known original');
      const reviewedHelper=execFileSync('git',['-C',toolsRoot,'show',`${FONT_COUNT_BRIDGE.sourceSha}:${BRIDGE_PATH}`]);
      assert.equal(digest(reviewedHelper),FONT_COUNT_BRIDGE.reviewedSha256,'pinned test helper differs from reviewed bytes');
      writeFileSync(path.join(coreRoot,'artifacts/published-control/original-lazy-font-counts.mjs'),originalHelper);
      writeFileSync(helper,reviewedHelper);
      record.testToolingBridge={path:BRIDGE_PATH,...FONT_COUNT_BRIDGE};
      record.qualification='published runtime with reviewed registry-plan metadata and recorded pinned test-tooling bridge; not pristine source';
    }
  }
  const bridgeSet=published019Plan(reviewed)?{label:'0.19',source:PUBLISHED_019_SOURCE,tooling:PUBLISHED_019_TOOLING}:published0242Plan(reviewed)?{label:'0.24.2',source:PUBLISHED_0242_SOURCE,tooling:PUBLISHED_0242_TOOLING}:null;
  if(bridgeSet){
    assert.equal(record.sourceSha,bridgeSet.source,`published ${bridgeSet.label} source identity differs`);
    for(const bridge of bridgeSet.tooling){
      const file=path.join(coreRoot,bridge.path);
      if(bridge.originalSha256===null)assert.ok(!existsSync(file),'unexpected original test helper');
      else{
        const original=regularBytes(file);assert.equal(digest(original),bridge.originalSha256,`published ${bridgeSet.label} test preimage differs`);
        const backup=path.join(coreRoot,'artifacts/published-control/original-tooling',bridge.path);mkdirSync(path.dirname(backup),{recursive:true});writeFileSync(backup,original);
      }
      const reviewedBytes=execFileSync('git',['-C',toolsRoot,'show',`${bridge.sourceSha}:${bridge.path}`]);assert.equal(digest(reviewedBytes),bridge.reviewedSha256,`reviewed ${bridgeSet.label} tooling blob differs`);
      writeFileSync(file,reviewedBytes);
    }
    record.testToolingBridges=bridgeSet.tooling;
    record.qualification=`published ${bridgeSet.label} runtime with recorded exact test-tooling bridge; not pristine source`;
  }
  writeFileSync(path.join(coreRoot,'artifacts/published-control/metadata.json'),`${JSON.stringify(record,null,2)}\n`);
  writeFileSync(target,reviewedBytes);
  return record;
}
export function verifyPublishedControlPlan({toolsRoot,coreRoot}){
  const record=readRegularJson(path.join(coreRoot,'artifacts/published-control/metadata.json'));
  const target=path.join(coreRoot,'release-plan.json'),source=path.join(toolsRoot,'release-plan.json');
  assert.equal(git(coreRoot,'rev-parse','HEAD'),record.sourceSha);
  assert.equal(digest(readFileSync(target)),record.reviewedSha256);
  assert.equal(digest(readFileSync(source)),record.reviewedSha256);
  assert.equal(digest(execFileSync('git',['-C',coreRoot,'show','HEAD:release-plan.json'])),record.originalSha256);
  assert.equal(digest(readFileSync(path.join(coreRoot,'artifacts/published-control/original-release-plan.json'))),record.originalSha256);
  assert.deepEqual(readRegularJson(target),record.reviewedPlan);
  const allowed=['release-plan.json'];
  const allowedUntracked=[];
  if(record.testToolingBridges){
    const bridgeSet=published019Plan(record.reviewedPlan)?{source:PUBLISHED_019_SOURCE,tooling:PUBLISHED_019_TOOLING,label:'0.19'}:published0242Plan(record.reviewedPlan)?{source:PUBLISHED_0242_SOURCE,tooling:PUBLISHED_0242_TOOLING,label:'0.24.2'}:null;
    assert.ok(bridgeSet,'tooling bridges are recorded only for a known published graph');assert.equal(record.sourceSha,bridgeSet.source);
    assert.deepEqual(record.testToolingBridges,bridgeSet.tooling,`unknown ${bridgeSet.label} tooling override`);
    for(const bridge of bridgeSet.tooling){
      if(bridge.originalSha256===null){
        assert.throws(()=>execFileSync('git',['-C',coreRoot,'show',`HEAD:${bridge.path}`],{stdio:'pipe'}),'original source unexpectedly contained helper');allowedUntracked.push(bridge.path);
      }else{
        assert.equal(digest(execFileSync('git',['-C',coreRoot,'show',`HEAD:${bridge.path}`])),bridge.originalSha256,'original 0.19 test identity changed');
        assert.equal(digest(regularBytes(path.join(coreRoot,'artifacts/published-control/original-tooling',bridge.path))),bridge.originalSha256,'retained original tooling changed');
      }
      assert.equal(digest(regularBytes(path.join(coreRoot,bridge.path))),bridge.reviewedSha256,'0.19 helper identity changed');
      assert.equal(digest(execFileSync('git',['-C',toolsRoot,'show',`${bridge.sourceSha}:${bridge.path}`])),bridge.reviewedSha256);allowed.push(bridge.path);
    }
  }
  const untracked=git(coreRoot,'ls-files','--others','--exclude-standard').split('\n').filter(Boolean);
  assert.ok(untracked.every(file=>allowedUntracked.includes(file)),'published control contains untracked source files');
  if(record.testToolingBridge){
    assert.deepEqual(record.testToolingBridge,{path:BRIDGE_PATH,...FONT_COUNT_BRIDGE},'unknown test-tooling override');
    assert.equal(record.reviewedPlan.packages.find(item=>item.name==='@openpresentation/opf-render').version,'0.18.2');
    assert.equal(digest(execFileSync('git',['-C',coreRoot,'show',`HEAD:${BRIDGE_PATH}`])),FONT_COUNT_BRIDGE.originalSha256,'original helper identity changed');
    assert.equal(digest(regularBytes(path.join(coreRoot,'artifacts/published-control/original-lazy-font-counts.mjs'))),FONT_COUNT_BRIDGE.originalSha256);
    assert.equal(digest(regularBytes(path.join(coreRoot,BRIDGE_PATH))),FONT_COUNT_BRIDGE.reviewedSha256,'bridged helper identity changed');
    assert.equal(digest(execFileSync('git',['-C',toolsRoot,'show',`${FONT_COUNT_BRIDGE.sourceSha}:${BRIDGE_PATH}`])),FONT_COUNT_BRIDGE.reviewedSha256);
    allowed.push(BRIDGE_PATH);
  }
  const files=git(coreRoot,'diff','--name-only','HEAD').split('\n').filter(Boolean);
  assert.ok(files.every(file=>allowed.includes(file)),'published control altered source outside its exact metadata/tooling override');
  return record;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,toolsRoot,coreRoot]=process.argv.slice(2);
  assert.ok(['stage','verify'].includes(command));
  if(command==='stage')await publishedGalleryControl(readRegularJson(path.join(toolsRoot,'release-plan.json')));
  console.log(JSON.stringify((command==='stage'?stagePublishedControlPlan:verifyPublishedControlPlan)({toolsRoot,coreRoot}),null,2));
}
