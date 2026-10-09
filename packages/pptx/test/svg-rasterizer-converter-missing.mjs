// RR-63: opf-render 0.16 makes its PNG converter (@resvg/resvg-js) an optional peer. An installed opf-render whose converter is
// missing rejects svgToPng with `converter-missing`; the exporter maps that to its existing `svg-rasterizer-unavailable`
// path (placeholder plus an unresolved-asset diagnostic, or a throw under strictAssets) and keeps render's install command in
// the message. Any other renderer failure stays `svg-render-failed`.
//
// The first block replaces opf-render with a stub that throws render's documented error, so it holds for any renderer version.
// The second block runs the real renderer with `@resvg/resvg-js` blocked and runs only when the installed opf-render has the
// `/png` entry (0.16 and later).
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = JSON.stringify(new URL('../dist/index.js', import.meta.url).href);
const fallback = JSON.stringify(new URL('../dist/image-fallback-node.js', import.meta.url).href);
const INSTALL = 'npm install @resvg/resvg-js@^2.6.2';

const preamble = hook => `
  import assert from 'node:assert/strict';
  import {register} from 'node:module';
  register('data:text/javascript,'+encodeURIComponent(${JSON.stringify(hook)}),import.meta.url);
  const {toPptx}=await import(${dist});
  const NS='xmlns="http://www.w3.org/2000/svg"';
  const svg='<svg '+NS+' width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" fill="#cc0000"/></svg>';
  const deck={slides:[{title:'T',image:{src:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'),alt:'Logo'}}]};
`;

const run = (script, label) => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-'], {input: script, encoding: 'utf8', cwd: root});
  assert.equal(child.status, 0, `${label}\n${child.stderr}${child.stdout}`);
  return child.stdout;
};

// ---- 1. A stub opf-render whose svgToPng rejects like render 0.16 with a missing converter.
{
  const stubSource = `
    export async function svgToPng() {
      throw Object.assign(new Error('@resvg/resvg-js is not installed. It is an optional peer dependency of @openpresentation/opf-render, used for PNG output: run \`${INSTALL}\`.'), {
        code: 'converter-missing',
        details: {package: '@resvg/resvg-js', range: '^2.6.2', install: '${INSTALL}', purpose: 'PNG output', installed: false},
      });
    }`;
  const hook = `export async function resolve(s,c,n){if(s==="@openpresentation/opf-render")return{url:"data:text/javascript,"+encodeURIComponent(${JSON.stringify(stubSource)}),shortCircuit:true};return n(s,c);}`;
  run(`${preamble(hook)}
    // The adapter alone: the mapped code, the kept install command and the original error as the cause.
    const {svgToPng}=await import(${fallback});
    await assert.rejects(svgToPng(svg,{scale:1,text:false}),error=>{
      assert.equal(error.code,'svg-rasterizer-unavailable');
      assert.equal(error.install,${JSON.stringify(INSTALL)});
      assert.ok(error.message.includes(${JSON.stringify(INSTALL)}),error.message);
      assert.equal(error.cause?.code,'converter-missing');
      return true;
    });
    // The exporter: placeholder and diagnostic, with the install command in the message.
    const diagnostics=[];
    const bytes=await toPptx(deck,{provenance:false,onDiagnostic:d=>diagnostics.push(d)});
    assert.ok(bytes.byteLength>1000);
    assert.deepEqual(diagnostics.map(d=>({code:d.code,reason:d.reason,path:d.path})),[{code:'unresolved-asset',reason:'svg-rasterizer-unavailable',path:'slides.0.image'}]);
    assert.ok(diagnostics[0].message.includes(${JSON.stringify(INSTALL)}),diagnostics[0].message);
    assert.match(diagnostics[0].message,/opf-render/);
    await assert.rejects(toPptx(deck,{strictAssets:true}),e=>e.code==='svg-rasterizer-unavailable'&&e.details.path==='slides.0.image'&&e.message.includes(${JSON.stringify(INSTALL)}));
    // A host rasterizer replaces the default and needs no converter.
    const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO8sAAAAASUVORK5CYII=','base64'));
    await toPptx(deck,{provenance:false,svgRasterizer:async()=>png,strictAssets:true});
    console.log('ok');`, 'stubbed converter-missing');
}

// ---- 2. Any other renderer error is not a missing rasterizer.
{
  const stubSource = `export async function svgToPng() { throw Object.assign(new Error('boom'), {code: 'font-resource-unavailable'}); }`;
  const hook = `export async function resolve(s,c,n){if(s==="@openpresentation/opf-render")return{url:"data:text/javascript,"+encodeURIComponent(${JSON.stringify(stubSource)}),shortCircuit:true};return n(s,c);}`;
  run(`${preamble(hook)}
    const diagnostics=[];
    await toPptx(deck,{provenance:false,onDiagnostic:d=>diagnostics.push(d)});
    assert.deepEqual(diagnostics.map(d=>d.reason),['svg-render-failed']);
    console.log('ok');`, 'stubbed other renderer error');
}

// ---- 3. The real renderer with @resvg/resvg-js not installed (opf-render 0.16+).
let hasPngEntry = true;
try { await import('@openpresentation/opf-render/png'); } catch { hasPngEntry = false; }
if (hasPngEntry) {
  const hook = `export async function resolve(s,c,n){if(s==="@resvg/resvg-js")throw Object.assign(new Error("Cannot find package '@resvg/resvg-js' imported from opf-render"),{code:"ERR_MODULE_NOT_FOUND"});return n(s,c);}`;
  run(`${preamble(hook)}
    const diagnostics=[];
    await toPptx(deck,{provenance:false,onDiagnostic:d=>diagnostics.push(d)});
    assert.deepEqual(diagnostics.map(d=>d.reason),['svg-rasterizer-unavailable']);
    assert.ok(diagnostics[0].message.includes('npm install @resvg/resvg-js@'),diagnostics[0].message);
    await assert.rejects(toPptx(deck,{strictAssets:true}),e=>e.code==='svg-rasterizer-unavailable'&&e.message.includes('npm install @resvg/resvg-js@'));
    console.log('ok');`, 'real renderer, converter blocked');
} else {
  console.log('svg-rasterizer-converter-missing: installed opf-render has no /png entry (before 0.16); the real-renderer check is skipped.');
}

console.log('svg-rasterizer-converter-missing: converter-missing maps to svg-rasterizer-unavailable with the install command.');
