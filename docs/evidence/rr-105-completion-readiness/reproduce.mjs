// Build an exact copy of the existing live-completion test section, excluding unrelated edit/download sections.
// The optional control temporarily shows stale DOM text, then restores the actual catalog label; it never supplies catalog data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const mode=process.argv[2],stale=process.argv.includes('--stale');
assert.ok(mode==='before'||mode==='after','before|after [--stale]');
const root=fileURLToPath(new URL('../../../',import.meta.url)),relative='packages/editor/test/source-pane-browser.mjs';
const source=mode==='before'?execFileSync('git',['-C',root,'show','0e02db5a0aa6a68b7459fe62e3ed5b60f38784ea:'+relative],{encoding:'utf8'}):fs.readFileSync(path.join(root,relative),'utf8');
const start=source.indexOf('  // RR-98: live completions while typing JSON'),end=source.indexOf('  // RR-98: opening an example over another',start),preludeEnd=source.indexOf('  const page = await open();');
assert.ok(start>0&&end>start&&preludeEnd>0);
let block=source.slice(start,end);
if(stale){const anchor=`  await typing.keyboard.type('"tone": "cas');\n`;assert.ok(block.includes(anchor));block=block.replace(anchor,anchor+`  await popup.locator('.cm-completionLabel').filter({hasText: /^casual$/}).waitFor({timeout: 5000});
  await popup.locator('.cm-completionLabel').filter({hasText: /^casual$/}).evaluate(label => {
    const actualCatalogLabel=label.textContent;
    label.textContent='previous-field-completion';
    setTimeout(() => {label.textContent=actualCatalogLabel;},250);
  });
`);}
assert.ok(block.includes("'tone values come from the registered catalog'"),'retain the original catalog assertion');
const artifact=path.join(root,'packages/editor/artifacts/source-completion-'+mode+(stale?'-stale':'')+'.mjs');
fs.writeFileSync(artifact,source.slice(0,preludeEnd)+block+"  assert.deepEqual(requests, []);\n  assert.deepEqual(errors, []);\n  console.log('Focused source completions passed with original catalog assertions.');\n} finally { await browser?.close(); server.close(); }\n");
console.log(JSON.stringify({mode,stale,sourceSha256:createHash('sha256').update(source).digest('hex'),artifact,artifactSha256:createHash('sha256').update(fs.readFileSync(artifact)).digest('hex'),scope:'Existing live-completion section only; optional stale-DOM control restores the real catalog label.'}));
