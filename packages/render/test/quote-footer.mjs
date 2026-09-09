import assert from 'node:assert/strict';
import {renderSvg} from '../dist/svg.js';
import {loadBundledFontRegistry} from '../dist/fonts-node.js';
const fonts = await loadBundledFontRegistry();
let fitted = 0, rejected = 0;
for (const dimensions of [{width:1280,height:720},{width:540,height:960}]) {
  for (const repeats of [12,16,20,24,80]) {
    const deck = {design:{dimensions,fontScheme:'roboto'},slides:[{title:'A quote and its source',quote:{text:'A shared layout keeps the evidence readable when the words change. '.repeat(repeats),attribution:'A reviewer',source:'Recorded interview'}}]};
    const diagnostics = [];
    const svg = renderSvg(deck,{trace:true,textMeasurement:fonts.textMeasurement,onDiagnostic:value=>diagnostics.push(value)});
    if (diagnostics.some(value=>value.code==='text-overflow')) {
      deck.slides[0].composition = {overflow:'error'};
      assert.throws(()=>renderSvg(deck,{textMeasurement:fonts.textMeasurement}), {code:'layout-overflow'});
      rejected++;
      continue;
    }
    const body = [], footer = [];
    for (const [,attributes] of svg.matchAll(/<text\b([^>]*)>/g)) {
      const path = /data-opf-path="([^"]+)"/.exec(attributes)?.[1];
      const y = Number(/\by="([^"]+)"/.exec(attributes)?.[1]), size = Number(/font-size="([^"]+)"/.exec(attributes)?.[1]);
      if (path === 'slides.0.quote.text') body.push({y,size});
      if (path === 'slides.0.quote') footer.push({y,size});
    }
    assert.ok(body.length > 1 && footer.length > 0);
    assert.ok(Math.max(...body.map(line=>line.y+line.size*.22)) <= Math.min(...footer.map(line=>line.y-line.size)), 'Fitted quote lines must not cover the attribution footer');
    fitted++;
  }
}
assert.ok(fitted >= 4 && rejected >= 1, 'Both fitted and explicit overflow cases required');
console.log(`Quote footer passed: ${fitted} fitted long quotes retain separation, ${rejected} oversized cases diagnose/reject in strict mode across wide and portrait canvases.`);
