import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const webp='data:image/webp;base64,'+(await readFile(new URL('fixtures/images/wide.webp',import.meta.url))).toString('base64');
const png='data:image/png;base64,'+(await readFile(new URL('fixtures/images/wide.png',import.meta.url))).toString('base64');
const script=`
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('data:text/javascript,'+encodeURIComponent('export async function resolve(s,c,n){if(s==="sharp")throw new Error("Native decoder blocked for test");return n(s,c);}'),import.meta.url);
const {toPptx}=await import(${JSON.stringify(new URL('../dist/index.js',import.meta.url).href)});
await toPptx({slides:[{text:'No native decoder needed'}]});
await toPptx({slides:[{image:${JSON.stringify(png)}}]});
await toPptx({slides:[{image:${JSON.stringify(webp)}}]},{imageFormat:'preserve'});
await assert.rejects(toPptx({slides:[{image:${JSON.stringify(webp)}}]}),e=>e.code==='image-conversion-failed'&&e.path==='slides.0.image'&&e.details.cause.includes('Native decoder blocked'));
`;
const result=spawnSync(process.execPath,['--input-type=module','-'],{input:script,encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
console.log('Native decoder boundary passed: ordinary/preserved images work without Sharp; unavailable WebP conversion fails with its OPF path.');
