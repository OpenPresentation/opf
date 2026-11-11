// Source/geometry and shared PDF/outline layout controls. Native paint remains
// a separate qualification; this file never opens Office or reads a golden.
import assert from 'node:assert/strict';
import {readB07Sources} from '../../../scripts/native-acceptance/b07-current-source.mjs';
import {toSvg,resolvePresentation,toPdf} from '../dist/index.js';
import {loadFonts} from '../dist/fonts-node.js';
import {layoutText} from '../dist/pdf-text.js';
import {parseXml,textContent} from '../dist/pdf-xml.js';
import {ROOT_STYLE} from '../dist/pdf-style.js';
import {outlineLibrary} from '../dist/text-paths.js';
import {openPdf,pageItems} from './pdf-helpers.mjs';

const original=readB07Sources().find(row=>row.id==='rtl-contrast-05-mixed-explicit-arabic').document;
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:original});
const elements=node=>[node,...(node.children??[]).filter(child=>child.name).flatMap(elements)];
const markers=svg=>elements(parseXml(svg)).filter(node=>node.name==='text'&&node.attrs['aria-hidden']==='true'&&/^[()A-Za-z0-9.]+$/.test(textContent(node)));
const close=(actual,wanted,label)=>assert(Math.abs(actual-wanted)<=.001,`${label}: ${actual} vs ${wanted}`);
let checks=0;
try{
 await fonts.ensure({slides:[{text:[{text:'1. 12. XII. ab) (12)',fontFamily:'Intos'}]}]});
 const library=outlineLibrary(fonts),env={fonts:library,defaults:['Intos'],diagnostic:issue=>assert.fail(JSON.stringify(issue)),missing:issue=>assert.fail(JSON.stringify(issue)),unavailable:families=>Error('Missing actual face: '+families)};
 // One plain external SVG text chunk, in every logical anchor/direction. The
 // formula is independent of the shaper's character order and glyph widths.
 for(const direction of ['ltr','rtl'])for(const anchor of ['start','end','middle']){
  const markup=`<text x="200" y="80" font-family="Intos" font-size="40" direction="${direction}" text-anchor="${anchor}">12.</text>`,node=parseXml('<svg>'+markup+'</svg>').children.find(node=>node.name==='text'),runs=layoutText(node,env,ROOT_STYLE,null).runs;
  const width=runs.reduce((sum,run)=>sum+run.width,0),left=Math.min(...runs.map(run=>run.x)),right=Math.max(...runs.map(run=>run.x+run.width));assert(width>0);const expected=200-(anchor==='middle'?width/2:anchor===(direction==='rtl'?'start':'end')?width:0);close(left,expected,direction+' '+anchor+' left');close(right,expected+width,direction+' '+anchor+' right');assert.equal([...runs].sort((a,b)=>a.start-b.start).map(run=>run.logical).join(''),'12.');
  const diagnostics=[],outlined=fonts.outlines.outlineSlideText([markup],{report:issue=>diagnostics.push(issue),fail:(_code,message)=>Error(message)});assert.deepEqual(diagnostics,[]);const pens=[...outlined.content[0].matchAll(/<g transform="matrix\([^ ]+ 0 0 [^ ]+ (-?[\d.]+) (-?[\d.]+)\)">/g)].map(match=>Number(match[1]));assert(pens.length);close(Math.min(...pens),left,'outline/PDF layout start');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160">${markup}</svg>`,pdf=await openPdf(await toPdf(svg,{fonts:{fontFiles:fonts.registry.fontFiles,useBundledFonts:false},compress:false,strict:true}));try{const items=(await pageItems(pdf,1)).filter(item=>item.str.trim());assert(items.length);close(Math.min(...items.map(item=>item.transform[4])),left,'actual vector PDF initial pens');}finally{await pdf.loadingTask.destroy();}checks++;
 }
 // Keep the existing explicit-direction decision: absent/auto styles still
 // take LTR here, even when the first strong character is Arabic.
 for(const direction of [undefined,'auto']){const node=parseXml(`<svg><text x="200" y="80" font-family="Intos" font-size="40"${direction?' direction="'+direction+'"':''} text-anchor="end">12.</text></svg>`).children.find(node=>node.name==='text'),runs=layoutText(node,env,ROOT_STYLE,null).runs;close(Math.max(...runs.map(run=>run.x+run.width)),200,'existing absent/auto direction anchor');checks++;}
 for(const language of ['ar-SA','en-US'])for(const style of ['arabic','roman-upper','roman-lower','alpha-upper','alpha-lower'])for(const suffix of ['period','paren','paren-both']){
  const document={language,slides:[{title:'Markers',items:['العنصر الأول','Second item','عنصر آخر'],numbering:{style,suffix,start:12}}]},before=JSON.stringify(document),bound=resolvePresentation(document,{fonts}).slides[0],geometry=JSON.stringify(bound.geometry),svg=toSvg(document,1,{fonts,trace:true}),nodes=markers(svg),entries=bound.geometry.items.find(item=>item.field==='items').text.listEntries;assert.equal(nodes.length,entries.length);
  entries.forEach((entry,index)=>{const node=nodes[index],rtl=entry.direction==='rtl';assert.equal(textContent(node),entry.marker.text);assert(!/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(textContent(node)));assert.equal(node.attrs.direction,rtl?'rtl':undefined);assert.equal(node.attrs['unicode-bidi'],rtl?'isolate':undefined);assert.equal(node.attrs['text-anchor'],rtl?'start':undefined);close(Number(node.attrs.x),entry.marker.x,'unchanged core physical marker edge');close(Number(node.attrs.y),entry.marker.y,'unchanged core marker baseline');const runs=layoutText(node,env,ROOT_STYLE,null).runs;close(rtl?Math.max(...runs.map(run=>run.x+run.width)):Math.min(...runs.map(run=>run.x)),Number(node.attrs.x),'physical marker edge in shared vector/outline layout');});
  assert.equal(JSON.stringify(document),before);assert.equal(JSON.stringify(bound.geometry),geometry,'Body geometry is not mutated by marker rendering');checks++;
 }
 const before=JSON.stringify(original),svg=toSvg(original,1,{fonts,trace:true}),marker=markers(svg);assert.equal(marker.length,1);assert.equal(textContent(marker[0]),'1.');assert.equal(marker[0].attrs.direction,'rtl');assert.equal(marker[0].attrs['text-anchor'],'start');assert.equal(JSON.stringify(original),before);
 console.log(JSON.stringify({passed:true,checks,nativePaintAccepted:false,scope:'Logical tokens and exact physical marker edges, plain external SVG anchors and actual PDF/outline placement; native residuals remain open.'}));
}finally{fonts.dispose?.();}
