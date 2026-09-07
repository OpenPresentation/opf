import assert from 'node:assert/strict';
import { composeSlide, fitText, wrapText, OPFCompositionError } from '../dist/composition.js';
import { validatePresentation, validateCatalogRecord } from '../dist/index.js';

const blocks = n => Array.from({ length: n }, (_, i) => ({ text: `Block ${i + 1}: a readable explanation.` }));
const overlaps = (a, b) => a.x < b.x + b.width - 1e-5 && a.x + a.width > b.x + 1e-5 && a.y < b.y + b.height - 1e-5 && a.y + a.height > b.y + 1e-5;
for (const dimensions of [[1280,720],[720,1280],[1024,768],[320,180]]) {
  for (const mode of ['auto','grid','row','column']) {
    for (let count = 1; count <= 24; count++) {
      const slide = { title: 'A heading that must remain visible', blocks: blocks(count), composition: { mode, columns: 3 } };
      const result = composeSlide(slide, { width: dimensions[0], height: dimensions[1] });
      assert.equal(result.items.length, count + 1);
      assert.deepEqual(result, composeSlide(slide, { width: dimensions[0], height: dimensions[1] }));
      result.items.forEach(({ box }, i) => {
        assert.ok(box.width > 0 && box.height > 0);
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= dimensions[0] + 1e-5 && box.y + box.height <= dimensions[1] + 1e-5);
        for (const other of result.items.slice(i+1)) assert.equal(overlaps(box,other.box),false);
      });
    }
  }
}
const thirds = composeSlide({ top: { text: 'Top' }, middle: { text: 'Middle' }, bottom: { text: 'Bottom' } });
assert.equal(thirds.items.length, 3);
const byValue = Object.fromEntries(thirds.items.map(item => [item.value,item.box]));
assert.ok(byValue.Top.y < byValue.Middle.y && byValue.Middle.y < byValue.Bottom.y);
assert.equal(overlaps(byValue.Top,byValue.Bottom),false);
const crowded = composeSlide({ blocks: blocks(6) }, { layout: { placeholders: [{ type:'text' },{ type:'text' }] } });
assert.equal(crowded.items.length,6);
for (let i=0;i<6;i++) for (let j=i+1;j<6;j++) assert.equal(overlaps(crowded.items[i].box,crowded.items[j].box),false);
const weighted = composeSlide({ blocks:blocks(2),composition:{ mode:'row',weights:[2,1] } });
assert.ok(Math.abs(weighted.items[0].box.width / weighted.items[1].box.width - 2) < 1e-5);
const inherited = composeSlide({ blocks:blocks(2),composition:{ gap:0 } }, {layout:{ composition:{ mode:'column',weights:[2,1] } }});
assert.equal(inherited.composition.mode,'column');
assert.ok(Math.abs(inherited.items[0].box.height/inherited.items[1].box.height-2)<1e-5);
assert.equal(wrapText('abcdefghijk',20,16).join(''),'abcdefghijk');
assert.equal(wrapText('你好世界你好世界',20,16).join(''),'你好世界你好世界');
assert.deepEqual(wrapText('one\ntwo',100,16),['one','two']);
const huge = 'Never lose my text. '.repeat(1000);
const overflow = composeSlide({ text:huge });
assert.equal(overflow.diagnostics[0].code,'text-overflow');
assert.ok(overflow.items[0].text.lines.join(' ').includes('Never lose my text.'));
assert.throws(()=>composeSlide({text:huge,composition:{overflow:'error'}}),OPFCompositionError);
assert.throws(()=>composeSlide({composition:{gap:NaN}}),RangeError);
assert.throws(()=>composeSlide({}, {width:Infinity}),RangeError);
assert.throws(()=>fitText('test',{x:0,y:0,width:0,height:10}),RangeError);
for (const composition of [{mode:'banana'},{columns:0},{gap:-1},{weights:[0]},{minFontSize:2},{overflow:'clip'},{typo:true}]) {
 assert.equal(validatePresentation({slides:[{text:'hello',composition}]}).valid,false,JSON.stringify(composition));
}
assert.equal(validatePresentation({slides:[{text:'hello',composition:{mode:'auto',columns:3}}]}).valid,true);
assert.equal(validateCatalogRecord('layout',{$schema:'https://openpresentation.org/schema/opf-layout/v1',id:'dynamic',name:'Dynamic',composition:{mode:'auto'}}).valid,true);
console.log('Composition: geometry, preservation, responsive grids, weights, regions, diagnostics and schemas passed.');
const { resolveCanvasDimensions } = await import('../dist/composition.js');
assert.deepEqual(resolveCanvasDimensions({preset:'16:9',widthInches:7.5,heightInches:13.333333333333334}),{width:720,height:1280});
assert.deepEqual(resolveCanvasDimensions('standard'),{width:960,height:720});

assert.equal(validatePresentation({slides:[{id:'same',title:'One'},{id:'same',title:'Two'}]}).valid,false);

const nested = { title:'Nested composition', composition:{mode:'row',weights:[2,1],gap:0.04}, blocks:[
  { type:'group',composition:{mode:'column',weights:[1,2],padding:0.04},blocks:[{text:'First'},{blocks:[{text:'Second'},{text:'Third'}],composition:{mode:'row'}}]},
  {text:'Fourth'},
]};
assert.equal(validatePresentation({slides:[nested]}).valid,true);
for (const dimensions of [[1280,720],[720,1280],[320,180]]) {
 const result=composeSlide(nested,{width:dimensions[0],height:dimensions[1],slideIndex:2});
 assert.equal(result.items.length,5); assert.equal(result.groups.length,2);
 assert.deepEqual(result,composeSlide(nested,{width:dimensions[0],height:dimensions[1],slideIndex:2}));
 assert.equal(result.items[2].path,'slides.2.blocks.0.blocks.1.blocks.0.text');
 for (const [i,item] of result.items.entries()) {
  for (const other of result.items.slice(i+1)) assert.equal(overlaps(item.box,other.box),false);
  for (const group of result.groups.filter(group=>item.path.startsWith(group.path+'.'))) {
   assert.ok(item.box.x>=group.contentBox.x-1e-5 && item.box.y>=group.contentBox.y-1e-5);
   assert.ok(item.box.x+item.box.width<=group.contentBox.x+group.contentBox.width+1e-5);
   assert.ok(item.box.y+item.box.height<=group.contentBox.y+group.contentBox.height+1e-5);
  }
 }
}
const groupInRegion=composeSlide({left:{blocks:[{text:'A'},{text:'B'}],composition:{mode:'column'}},right:{text:'C'}});
assert.equal(groupInRegion.groups.length,1);assert.equal(groupInRegion.items.length,3);
assert.ok(groupInRegion.items[1].box.y>groupInRegion.items[0].box.y);
for(const invalid of [{blocks:[]},{type:'group'},{text:'Leaf',composition:{mode:'row'}},{blocks:[{text:'A'}],image:'image.png'},{type:'text',blocks:[{text:'A'}]}]) {
 assert.equal(validatePresentation({slides:[{blocks:[invalid]}]}).valid,false,JSON.stringify(invalid));
}
const constrained={composition:{minFontSize:24,overflow:'error'},blocks:[{composition:{overflow:'warn'},blocks:[{text:huge}]}]};
assert.throws(()=>composeSlide(constrained),OPFCompositionError);
assert.throws(()=>composeSlide({blocks:[{composition:{overflow:'error'},blocks:[{text:huge}]}]}),OPFCompositionError);
const inheritedGroup=composeSlide({composition:{minFontSize:24},blocks:[{blocks:[{text:huge}]}]});
assert.equal(inheritedGroup.items[0].text.fontSize,24);
let deep={text:'Preserved'};
for(let i=0;i<32;i++) deep={blocks:[deep]};
assert.equal(validatePresentation({slides:[{blocks:[deep]}]}).valid,true);
assert.equal(composeSlide({blocks:[deep]}).items[0].value,'Preserved');
deep={blocks:[deep]};
assert.equal(validatePresentation({slides:[{blocks:[deep]}]}).valid,false);
assert.throws(()=>composeSlide({blocks:[deep]}),RangeError);
const cyclic={blocks:[]};cyclic.blocks.push(cyclic);
assert.equal(validatePresentation({slides:[{blocks:[cyclic]}]}).valid,false);
assert.throws(()=>composeSlide({blocks:[cyclic]}),RangeError);
console.log('Nested groups: containment, source paths, region composition, inheritance, strict overflow and depth guards passed.');
const calls=[];
const measurement={measure:(text,size,style)=>{calls.push(style);return text.length*size;},resolveStyle:style=>({...style,fontFamily:'Measured Family'})};
const measured=composeSlide({title:'Font roles',text:'A measured text line.'},{fonts:{heading:'Heading',body:'Body'},textMeasurement:measurement});
assert.equal(measured.items[0].textStyle.fontFamily,'Measured Family');
assert.ok(calls.some(style=>style.fontWeight===700)&&calls.some(style=>style.fontWeight===400));
assert.throws(()=>composeSlide({text:'x'},{textMeasurement:{measure:()=>NaN}}),RangeError);
assert.throws(()=>composeSlide({text:'x'},{textMeasurement:{measure:()=>-1}}),RangeError);
assert.ok(wrapText('WWW iii',80,20,(text,size)=>text.length*size).length>wrapText('WWW iii',80,20,()=>10).length);
