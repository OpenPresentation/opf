import assert from 'node:assert/strict';
import {composeSlide} from '@openpresentation/opf/composition';
import {toSvg,OPFRenderError} from '../dist/index.js';
const shape={shape:'ellipse',x:0.2692,y:-0.1,width:0.42,height:0.75,fill:'#8000CC',stroke:'none',layer:'back',decorative:true,opacity:0.45,softEdge:60};
const deck={name:'Bleed',language:'en-US',slides:[{title:'Slide',shapes:[shape]}]};
const composed=composeSlide(deck.slides[0],{presentation:deck});
const svg=toSvg(deck,1,{trace:true});
assert.ok(composed.overlayShapes[0].box.y<0);
assert.ok(svg.includes('d="'+composed.overlayShapes[0].shape.paths[0].d+'"'),'negative geometry is drawn without repositioning');
assert.match(svg,/<svg[^>]+viewBox="0 0 1280 720"/,'the slide viewport stays fixed');
assert.match(svg,/data-opf-path="slides\.0\.shapes\.0"/);
assert.match(svg,/feGaussianBlur/,'the reported soft glow survives');
console.log('SH-27 off-slide SVG passed');

for(const value of [1e300,-1e300,1e20,-1e20])assert.throws(()=>toSvg({slides:[{shapes:[{...shape,x:value}]}]},1),error=>error instanceof OPFRenderError&&error.code==='invalid-opf'&&error.details.findings.some(f=>f.path==='/slides/0/shapes/0/x'&&/safe integer native coordinate/.test(f.message)),'no SVG with nonfinite or unrepresentable geometry');
