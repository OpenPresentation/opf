import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium} from 'playwright';
import {renderSvg,resolvePresentation} from '../dist/svg.js';
import {prepareNodeFonts} from '../dist/fonts-node.js';
const {registry,options:fontOptions}=await prepareNodeFonts(),output=path.resolve(process.argv[2]??'artifacts/rich-flow-browser');
await mkdir(output,{recursive:true});
const fixtures=[
  ['  Keep  ',{text:'bold',bold:true},' and ',{text:'italic',italic:true},' with trailing  '],
  ['Link ',{text:'selected words',link:'https://example.org',underline:true,color:'#2563eb'},' and ',{text:'struck',strikethrough:true}],
  ['Normal ',{text:'raised',superscript:true},' restored ',{text:'lowered',subscript:true},' baseline'],
  ['\nFirst ',{text:'paragraph\r\n',bold:true},'\nFinal paragraph\n\n'],
  [{text:'Italic first',italic:true},' returns to normal ',{text:'bold only',bold:true}],
];
const browser=await chromium.launch({channel:process.platform==='win32'&&!process.env.CI?'msedge':undefined}),errors=[],requests=[],results=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});await page.setContent('<main></main>');
  await page.evaluate(async faces=>{for(const face of faces)document.fonts.add(await new FontFace(face.family,`url(${face.dataUrl})`,{weight:String(face.weight),style:face.italic?'italic':'normal'}).load());await document.fonts.ready;},registry.embeddedFonts);
  for(const mode of ['estimated','measured'])for(const align of ['left','center','right'])for(const [index,text]of fixtures.entries()) {
    const document={design:{fontScheme:'roboto',contentAlignment:align},slides:[{text}]},before=structuredClone(document),options={trace:true,...(mode==='measured'?{textMeasurement:fontOptions.textMeasurement}:{})};
    const bound=resolvePresentation(document,options).slides[0],item=bound.geometry.items.find(item=>item.field==='text'),svg=renderSvg(document,options);
    assert.deepEqual(document,before);
    const actual=await page.evaluate(async({svg,item,mode,align})=>{
      document.querySelector('main').innerHTML=svg;await document.fonts.ready;
      const group=document.querySelector(`g[data-opf-path="${item.path}"]`),nodes=[...group.querySelectorAll('[data-opf-text-start]')],source=item.value.map(run=>typeof run==='string'?run:run.text).join('');
      if(group.dataset.opfRichSpacing!==(mode==='estimated'?'natural':'measured'))throw Error('Wrong spacing mode');
      let cursor=0;const lines=[];
      for(const [lineIndex,line]of item.text.richLines.entries()) {
        let previous;const fragments=[];
        for(const fragment of line.fragments) {
          const node=nodes[cursor++];if(!node||source.slice(+node.dataset.opfTextStart,+node.dataset.opfTextEnd)!==node.textContent||node.textContent!==fragment.text)throw Error('Source trace changed');
          const start=node.getStartPositionOfChar(0),end=node.getEndPositionOfChar(node.getNumberOfChars()-1),computed=getComputedStyle(node);
          if(computed.fontWeight!==String(fragment.style.fontWeight)||computed.fontStyle!==(fragment.style.italic?'italic':'normal'))throw Error('Physical style changed');
          if(fragment.run.link&&node.closest('a')?.getAttribute('href')!==fragment.run.link)throw Error('Link changed');
          if(fragment.run.underline&&!computed.textDecorationLine.includes('underline'))throw Error('Underline lost');
          if(fragment.run.strikethrough&&!computed.textDecorationLine.includes('line-through'))throw Error('Strike lost');
          const placed=item.text.placement?.lines[lineIndex],expectedY=(placed?.baseline??item.box.y+line.baseline)+fragment.baselineShift;
          fragments.push({text:fragment.text,tag:node.tagName,gap:previous?start.x-previous.x:null,baselineDifference:start.y-expectedY});previous=end;
        }
        let alignmentDifference=0;
        if(mode==='estimated'&&line.fragments.length) {
          const element=nodes[cursor-line.fragments.length].closest('text'),width=element.getComputedTextLength(),start=element.getStartPositionOfChar(0).x;
          const expected=item.box.x+(align==='right'?item.box.width-width:align==='center'?(item.box.width-width)/2:0);alignmentDifference=start-expected;
        }
        lines.push({fragments,alignmentDifference});
      }
      if(cursor!==nodes.length)throw Error('Extra source fragments');return {lines};
    },{svg,item,mode,align});
    for(const line of actual.lines){assert.ok(Math.abs(line.alignmentDifference)<.1);for(const fragment of line.fragments){assert.ok(Math.abs(fragment.gap??0)<.1,'Adjacent runs must not have a layout gap');assert.ok(Math.abs(fragment.baselineDifference)<.1,'Script baseline must match the selected shift');}}
    results.push({mode,align,fixture:index,...actual});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  await writeFile(path.join(output,'report.json'),JSON.stringify({node:process.version,browser:browser.version(),verifierSha256:hash(await readFile(new URL(import.meta.url))),rendererSha256:hash(await readFile(new URL('../dist/svg.js',import.meta.url))),results,errors,requests,scope:'30 actual offline browser cases check source spans, adjacent-run spacing, alignment, baseline shifts, exact requested styles, decorations and links. Estimated line breaks and cell fitting remain approximate; native Office and complete shaping fidelity are separate.'},null,2)+'\n');
  console.log('All 30 rich-flow browser cases pass source/style/alignment/baseline and spacing checks.');
}finally{await browser.close();}
