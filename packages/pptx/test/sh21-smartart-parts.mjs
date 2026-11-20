// Independent native data-model and paint controls. Eligibility is qualified separately through the product export.
import assert from 'node:assert/strict';
import {XMLValidator} from 'fast-xml-parser';
import {composeSlide} from '@openpresentation/opf/composition';
import {smartArtDataXml,smartArtDrawingXml,smartArtColorsXml,smartArtQuickStyleXml,exportPaint} from '../src/smart-art.js';
import {outlineItems,readSmartArtModel,smartArtForm} from '../src/smart-art-import.js';
const tree=[{text:'Root',level:0},{text:'Build',level:1},{text:'Web',level:2},{text:'App',level:2},{text:'Ship',level:1}];
for(const kind of ['org-chart','hierarchy','venn'])for(const count of kind==='venn'?[3,5,7]:[5]){
 const values=kind==='venn'?Array.from({length:count},(_,i)=>String(i+1)):tree,layout={name:kind,direction:'column',regions:[{name:'title'},{name:'nodes',accepts:['list'],role:'primary',flow:'none',arrangement:kind}]},c=composeSlide({layout:kind,title:'A clear plan',items:values},{layout}),arrangement=c.arrangements?.[0];assert.ok(arrangement,kind+'/'+count);
 const record={arrangement,values,item:c.items.find(i=>i.field==='items'),paint:exportPaint({colors:{accent:'2563EB',background:'FFFFFF',text:'111111'}}),lang:'en-US',fontOf:()=>({fontFace:'Arial'}),rtl:false};
 const data=smartArtDataXml(record,1,'rId4'),drawing=smartArtDrawingXml(record,1),colors=smartArtColorsXml(record.paint,undefined,true,kind),style=smartArtQuickStyleXml(kind);
 for(const xml of [data,drawing,colors,style])assert.equal(XMLValidator.validate(xml),true);
 const model=readSmartArtModel(data);assert.equal(model.roots.length,kind==='venn'?count:1);const entries=outlineItems(model.roots);const semantic=xs=>xs.map(v=>typeof v==='string'?{text:v,level:0}:{...v,level:v.level??0});assert.deepEqual(semantic(entries),semantic(values));assert.equal(smartArtForm(model.layoutId,model.category).arrangement,kind);
 assert.ok(data.includes('/'+kind+'" qsCatId="simple"'),'new kinds use distinct style identities');
 const shapes=(drawing.match(/<dsp:sp modelId=/g)||[]).length;assert.equal(shapes,kind==='hierarchy'?14:kind==='org-chart'?9:count>4?2*count:count);
 if(kind==='hierarchy'){assert.equal((drawing.match(/fmla="val 10000"/g)||[]).length,10);assert.ok(colors.includes('name="fgAcc0"'));assert.ok(colors.includes('alpha val="90000"'));}
 if(kind==='venn'){assert.ok(colors.includes('name="vennNode1"'));assert.ok(colors.includes('alpha val="50000"'));}
}
console.log('SH21 native parts pass: true parent/child data, source order/levels, XML, complete cache and isolated native paint roles.');
// An authored blank parent is semantic, unlike a native placeholder. Reparenting is read from the connections.
{
 const values=tree.map((value,index)=>index?value:{...value,text:''}),layout={name:'org-chart',direction:'column',regions:[{name:'title'},{name:'nodes',accepts:['list'],role:'primary',flow:'none',arrangement:'org-chart'}]},c=composeSlide({layout:'org-chart',items:values},{layout}),arrangement=c.arrangements[0],record={arrangement,values,item:c.items.find(i=>i.field==='items'),paint:exportPaint({colors:{accent:'2563EB',background:'FFFFFF',text:'111111'}}),lang:'en-US',fontOf:()=>({fontFace:'Arial'}),rtl:false};
 const data=smartArtDataXml(record,1,'rId4'),model=readSmartArtModel(data);assert.equal(model.roots.length,1);assert.equal(model.roots[0].children.length,2);assert.equal(outlineItems(model.roots)[0],'');
 const node=index=>'{00000001-0002-4'+String(index).padStart(3,'0')+'-8000-000000000000}',edited=data.replace('srcId="'+node(1)+'" destId="'+node(2)+'"','srcId="'+node(4)+'" destId="'+node(2)+'"');assert.notEqual(edited,data);
 const outline=outlineItems(readSmartArtModel(edited).roots);assert.deepEqual(outline.map(item=>({text:typeof item==='string'?item:item.text,level:item.level??0})),[{text:'',level:0},{text:'Build',level:1},{text:'App',level:2},{text:'Ship',level:1},{text:'Web',level:2}]);
}
