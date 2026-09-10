import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
import {renderSvg} from '@openpresentation/opf-render';
import {validatePresentation} from '@openpresentation/opf';
const out=document.querySelector('pre');let checks=0;
const check=(ok,message)=>{if(!ok)throw Error(message);checks++;};
try {
 const source={design:{theme:'classic',fontScheme:'roboto'},slides:[{title:'Native styled table import',table:{columns:['Team','Stage','Status'],rows:[
  [{value:'Design',rowSpan:2,style:{fill:'#DBEAFE',verticalAlign:'middle'}},'Preview',{value:[{text:'Ready',bold:true,color:'#166534'}],style:{fill:'#DCFCE7',align:'center'}}],
  [null,'Editing',{value:'In progress',style:{fill:'#FEF3C7',color:'#92400E',align:'center'}}],
  [{value:'One native merged cell',colSpan:3,style:{fill:'#F1F5F9',padding:{top:12,bottom:12},borders:{top:{color:'#64748B',width:2,dash:'dash'}}}},null,null]
 ]}}]};
 const diagnostics=[],deck=await fromPptx(await toPptx(source),{onDiagnostic:d=>diagnostics.push(d)});
 check(diagnostics.length===1&&diagnostics[0].code==='heading-import-reflow','Native properties import with one supported heading recovery diagnostic');
 check(deck.slides[0].title===source.slides[0].title,'The tagged native heading retains its current title text');
 check(validatePresentation(deck).valid,'Imported document validates');
 const table=deck.slides[0].blocks.find(block=>block.table).table;
 check(table.rows[0][0].rowSpan===2&&table.rows[1][0]===null,'Vertical anchor and covered slot');
 check(table.rows[2][0].colSpan===3&&table.rows[2][1]===null&&table.rows[2][2]===null,'Horizontal anchor and covered slots');
 check(table.rows[0][0].style.verticalAlign==='middle','Native vertical alignment');
 check(table.rows[2][0].style.borders.top.dash==='dash','Native dashed border');
 document.querySelector('main').innerHTML=renderSvg(deck,{trace:true});
 const tableBlock=deck.slides[0].blocks.findIndex(block=>block.table);
 const prefix=`slides.0.blocks.${tableBlock}.table`;
 const rect=document.querySelector(`rect[data-opf-path="${prefix}.rows.0.0"]`);
 check(rect?.getAttribute('fill')==='#DBEAFE','Imported fill appears on merged SVG rectangle');
 const rich=document.querySelector(`g[data-opf-path="${prefix}.rows.0.0.value"][data-opf-rich-text]`);
 check(!!rich,'Merged text retains editable value path');
 const bounds=rich.getBBox(),area=rect.getBBox();
 check(bounds.y>=area.y-1&&bounds.y+bounds.height<=area.y+area.height+1,'Merged text stays within its rectangle');
 check(!document.querySelector(`rect[data-opf-path="${prefix}.rows.1.0"]`),'Covered row has no duplicate rectangle');
 check(!!document.querySelector('line[stroke="#64748B"][stroke-dasharray]'),'Native border renders as dashed SVG line');
 const again=await fromPptx(await toPptx(deck));
 check(JSON.stringify(again.slides[0].blocks.find(b=>b.table).table)===JSON.stringify(table),'Browser native round-trip preserves styled grid');
 out.textContent=JSON.stringify({passed:true,checks},null,2);document.title='PASS: styled native table import';
}catch(error){out.textContent=error.stack;document.title='FAIL: styled native table import';console.error(error);}
