import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx} from '../dist/index.js';
import {prepareNodeFonts} from '@openpresentation/opf-render/fonts-node';
import {renderSvgDeck} from '@openpresentation/opf-render/svg';

// design.titleAlignment/contentAlignment are Design properties: the slide design
// overrides the deck and titles use titleAlignment while subtitle, tag and body
// text use contentAlignment. Native paragraphs must use the same alignment and
// anchor point as the renderer's preview, with and without outline measurement
// (core only returns an accepted placement.alignment when outlines are measured).
const {options:measured}=await prepareNodeFonts(),dec=new TextDecoder();
const native={left:'l',center:'ctr',right:'r'},anchor={start:'l',middle:'ctr',end:'r'};
const attr=(tag,name)=>tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
let lines=0;
const combos=[['center','center'],['right','left'],['left','right'],[undefined,'center'],[undefined,undefined]];
for(const options of [{},measured])for(const [width,height]of [[1280,720],[720,1280]])for(const [title,content]of combos)for(const [overrideTitle,overrideContent]of [['left','center'],['center',undefined]]) {
  const design=Object.fromEntries(Object.entries({titleAlignment:title,contentAlignment:content}).filter(([,value])=>value));
  const override=Object.fromEntries(Object.entries({titleAlignment:overrideTitle,contentAlignment:overrideContent}).filter(([,value])=>value));
  const deck={design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96},...design},slides:[
    {tag:'Tag',title:'Aligned heading',subtitle:'Aligned subtitle',text:'Aligned body text'},
    {title:'Overridden heading',subtitle:'Overridden subtitle',text:'Overridden body text',design:override},
  ]};
  const svgs=renderSvgDeck(deck,{...options,trace:true});
  const entries=unzipSync(await toPptx(deck,options));
  for(const [slideIndex,slide]of deck.slides.entries()) {
    const effective={...deck.design,...slide.design};
    const xml=dec.decode(entries[`ppt/slides/slide${slideIndex+1}.xml`]);
    const shapes=[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match=>match[0]);
    for(const field of ['tag','title','subtitle','text'].filter(field=>slide[field])) {
      const path=`slides.${slideIndex}.${field}`;
      const expected=native[(field==='title'?effective.titleAlignment:effective.contentAlignment)??'left'];
      const previews=[...svgs[slideIndex].matchAll(/<text\b[^>]*>/g)].map(match=>match[0]).filter(tag=>attr(tag,'data-opf-path')===path);
      assert.ok(previews.length,`${path} preview lines`);
      for(const [index,preview]of previews.entries()) {
        const name=`OPF ${field==='text'?'text':'heading'} ${path} line ${index}`;
        const shape=shapes.find(value=>value.includes(`name="${name}"`));
        assert.ok(shape,name);
        const algn=shape.match(/<a:pPr\b[^>]*\salgn="([^"]+)"/)?.[1]??'l';
        // An unset titleAlignment is left in core composition. Renderers before
        // FF-39 let it inherit contentAlignment without outline placement, so
        // that case checks the native side against core rather than the preview.
        const previewChecked=field!=='title'||effective.titleAlignment!==undefined;
        if(previewChecked)assert.equal(anchor[attr(preview,'text-anchor')??'start'],expected,`${name} preview alignment`);
        assert.equal(algn,expected,`${name} native alignment (${JSON.stringify(options===measured?'measured':'default')})`);
        const x=+shape.match(/<a:off x="(-?\d+)"/)[1]/9525,w=+shape.match(/<a:ext cx="(\d+)"/)[1]/9525;
        const nativeAnchor=algn==='ctr'?x+w/2:algn==='r'?x+w:x;
        if(previewChecked)assert.ok(Math.abs(nativeAnchor-+attr(preview,'x'))<.01,`${name} anchor ${nativeAnchor} vs preview ${attr(preview,'x')}`);
        lines++;
      }
    }
  }
}
console.log(`Design alignment export passed: ${lines} heading/body lines match the preview's deck/slide titleAlignment and contentAlignment anchors with default and outline measurement.`);
