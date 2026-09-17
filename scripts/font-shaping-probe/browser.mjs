import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {json} from './json.mjs';
const require = createRequire(new URL('../../../opf-render/package.json', import.meta.url));
const {chromium} = require('playwright');
const [fontRoot, root] = process.argv.slice(2);
if (!fontRoot || !root) throw new Error('Usage: node browser.mjs FONT_DIRECTORY OUTPUT_DIRECTORY');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = await readFile(path.join(root, 'fontkit-matrix.json'));
const source = JSON.parse(sourceBytes);
const javascript = JSON.parse(await readFile(path.join(root, 'javascript-matrix.json'), 'utf8'));
assert.equal(javascript.sourceSha256, hash(sourceBytes));
const faces = await Promise.all(source.faces.map(async face => {
  const bytes = await readFile(path.join(fontRoot, face.file)); assert.equal(hash(bytes), face.sha256);
  return {...face, data: bytes.toString('base64')};
}));
const assets = new Map();
for (const name of ['index.mjs', 'harfbuzz.js', 'harfbuzz.wasm']) assets.set(`/hb/${name}`, {
  body: await readFile(new URL(`./node_modules/harfbuzzjs/dist/${name}`, import.meta.url)),
  contentType: name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
});
assets.set('/model.mjs', {body: await readFile(new URL('./model.mjs', import.meta.url)), contentType:'text/javascript'});
assets.set('/', {contentType:'text/html', body: Buffer.from('<html lang="und"><head><link rel="icon" href="data:,"><script type="importmap">{"imports":{"harfbuzzjs":"/hb/index.mjs"}}</script></head><body><svg id="measure" width="1000" height="100"><text x="24" y="60" font-size="32" text-rendering="geometricPrecision" style="font-synthesis:none"></text></svg><main></main></body></html>')});
const browser = await chromium.launch(), requests = [], externalRequests = [], errors = [];
try {
  const page = await browser.newPage({viewport:{width:1000, height:820}});
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    const asset = url.origin === 'http://opf-probe.invalid' ? assets.get(url.pathname) : undefined;
    if (!asset) {externalRequests.push(url.href); return route.abort();}
    requests.push({path:url.pathname, sha256:hash(asset.body)});
    return route.fulfill(asset);
  });
  await page.goto('http://opf-probe.invalid/'); // Every allowed response is fulfilled from local bytes above.
  const actual = await page.evaluate(async ({faces, samples, fits}) => {
    const {createProbeShaper, engineVersion} = await import('/model.mjs');
    const shapers = new Map();
    for (const face of faces) {
      const bytes = Uint8Array.from(atob(face.data), character => character.charCodeAt(0));
      document.fonts.add(await new FontFace(face.id, bytes, {weight:String(face.weight), style:face.italic?'italic':'normal'}).load());
      shapers.set(face.id, createProbeShaper(bytes));
    }
    await document.fonts.ready;
    const text = document.querySelector('#measure text');
    const measure = (source, faceId) => {
      const face = faces.find(face => face.id === faceId);
      text.setAttribute('font-family', face.id); text.setAttribute('font-weight', String(face.weight)); text.setAttribute('font-style', face.italic?'italic':'normal');
      text.style.whiteSpace = 'pre';
      text.textContent = source;
      return {source:text.textContent, width:text.getComputedTextLength()};
    };
    const results = samples.map(item => {
      const measured = measure(item.text,item.face);
      return {id:item.id,source:measured.source,browserAt32:measured.width,...shapers.get(item.face).shape(item.text)};
    });
    const lineResults = fits.map(item => ({id:item.id, modes:['before','after'].map(mode => {
      const fit = item[mode], space = measure(' ', item.face).width;
      return {mode, lines:fit.sourceLines.map(line => {
        let x = 0;
        for (const segment of line.segments) {
          if (segment.kind === 'tab') x = (Math.floor(x/(space*4)+1e-9)+1)*space*4;
          else x += measure(item.text.slice(segment.start, segment.end), item.face).width;
        }
        return {text:item.text.slice(line.start,line.end), expected:line.width, actual:x, outside:x>item.box.width+.01};
      })};
    })}));
    document.querySelector('#measure').remove();
    document.body.style.cssText = 'margin:20px;font:15px system-ui;background:#fff;color:#111';
    const main = document.querySelector('main');
    const intro = document.createElement('p'); intro.textContent = 'Diagnostic only · Exact Akasia bytes · 32px text · Dashed box is the available width'; main.append(intro);
    for (const item of fits) {
      const title = document.createElement('h3'); title.textContent = item.id; main.append(title);
      const row = document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:20px'; main.append(row);
      for (const mode of ['before','after']) {
        const container = document.createElement('div'), label = document.createElement('div');
        label.textContent = mode === 'before' ? 'Current Fontkit measurement' : 'HarfBuzz probe measurement'; container.append(label); row.append(container);
        const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('width','450'); svg.setAttribute('height','180'); container.append(svg);
        const rectangle = document.createElementNS(svg.namespaceURI,'rect');
        for(const [key,value] of Object.entries({x:20,y:12,width:item.width,height:156,fill:'none',stroke:'#777','stroke-dasharray':'4 3'})) rectangle.setAttribute(key,String(value)); svg.append(rectangle);
        const face = faces.find(face => face.id === item.face), fit = item[mode];
        for(const [index,line] of fit.sourceLines.entries()) for(const segment of line.segments.filter(segment=>segment.kind==='text')) {
          const node=document.createElementNS(svg.namespaceURI,'text'); node.textContent=item.text.slice(segment.start,segment.end);
          for(const [key,value] of Object.entries({x:20+segment.x,y:44+index*fit.lineHeight,'font-family':face.id,'font-size':32,'font-weight':face.weight,'font-style':face.italic?'italic':'normal','text-rendering':'geometricPrecision','xml:space':'preserve'}))node.setAttribute(key,String(value));
          node.style.fontSynthesis='none'; node.style.whiteSpace='pre'; svg.append(node);
        }
      }
    }
    return {results,lineResults,engineVersion};
  }, {faces,samples:source.samples,fits:javascript.fits});
  const results = source.samples.map((item,index) => {
    const observed = actual.results[index], candidate = javascript.results[index];
    assert.equal(observed.id,item.id); assert.equal(observed.source,item.text);
    assert.deepEqual(observed.glyphs,candidate.glyphs); assert.deepEqual(observed.outline,candidate.outline);
    assert.equal(observed.width,candidate.width);
    return {id:item.id, face:item.face, cp:item.cp, form:item.form, text:item.text, fontkitAt32:item.fontkitAt32,
      harfbuzzAt32:candidate.harfbuzzAt32, browserAt32:observed.browserAt32,
      fontkitDelta:observed.browserAt32-item.fontkitAt32, harfbuzzDelta:observed.browserAt32-candidate.harfbuzzAt32};
  });
  const summary = faces.map(face => {
    const values=results.filter(item=>item.face===face.id);
    return {file:face.file,cases:values.length,fontkitOutside01:values.filter(item=>Math.abs(item.fontkitDelta)>=.1).length,
      harfbuzzOutside01:values.filter(item=>Math.abs(item.harfbuzzDelta)>=.1).length,
      maxFontkitDelta:Math.max(...values.map(item=>Math.abs(item.fontkitDelta))),maxHarfbuzzDelta:Math.max(...values.map(item=>Math.abs(item.harfbuzzDelta)))};
  });
  const screenshot=await page.locator('main').screenshot(); await writeFile(path.join(root,'wrapping.png'),screenshot);
  const report={node:process.version,browser:browser.version(),harfbuzz:actual.engineVersion,sourceSha256:hash(sourceBytes),
    requests,externalRequests,errors,summary,results,lines:actual.lineResults,nodeAndBrowserGlyphRunsMatch:true,
    browserGlyphRunsSha256:hash(Buffer.from(JSON.stringify(actual.results.map(({id,glyphs,width,outline})=>({id,glyphs,width,outline}))))),
    screenshotSha256:hash(screenshot)};
  await writeFile(path.join(root,'browser-matrix.json'),json(report));
  assert.deepEqual(errors,[]); assert.deepEqual(externalRequests,[]);
  assert.ok(results.every(item=>item.harfbuzzDelta===0));
  assert.equal(actual.lineResults[0].modes[0].lines.filter(line=>line.outside).length,1);
  for (const item of actual.lineResults) {
    for (const mode of item.modes) assert.ok(mode.lines.every(line=>Number.isFinite(line.actual)));
    assert.ok(item.modes[1].lines.every(line=>!line.outside&&Math.abs(line.actual-line.expected)<.1));
  }
  console.log(JSON.stringify({cases:results.length,summary,lines:actual.lineResults},null,2));
} finally {await browser.close();}
