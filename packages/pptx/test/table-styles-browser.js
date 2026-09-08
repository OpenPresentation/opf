import {fromPptx,toPptx} from '@openpresentation/opf-pptx';
import {renderSvg} from '@openpresentation/opf-render';
import {validatePresentation} from '@openpresentation/opf';
import {tableValues} from './table-values.js';
const out=document.querySelector('pre');let checks=0;
const check=(ok,message)=>{if(!ok)throw Error(message);checks++;};
const tableOf=deck=>tableValues(deck.slides[0].blocks.find(b=>b.table).table);
try {
 const response=await fetch('./conditional.pptx');check(response.ok,'Native fixture loads');
 const diagnostics=[],deck=await fromPptx(new Uint8Array(await response.arrayBuffer()),{onDiagnostic:d=>diagnostics.push(d)});
 check(!diagnostics.length,'Text-only embedded styles resolve without unsupported diagnostics');
 check(validatePresentation(deck).valid,'Imported OPF validates');
 const table=tableOf(deck),cell=(r,c)=>(r===0?table.columns:table.rows[r-1])[c][0];
 check(cell(0,0).color==='#D0D0D0'&&cell(0,4).color==='#C0C0C0','Top corner precedence');
 check(cell(4,0).color==='#A0A0A0'&&cell(4,4).color==='#909090','Bottom corner precedence');
 check(cell(1,1).color==='#404040'&&cell(1,2).color==='#505050','Column bands override row colors');
 check(cell(1,1).italic===true&&cell(2,1).italic===false,'Row bands retain inherited emphasis');
 check(cell(0,1).bold===true&&cell(0,1).fontFamily==='Aptos','Theme font and header emphasis');
 document.querySelector('main').innerHTML=renderSvg(deck,{trace:true});
 check(document.querySelectorAll('[data-opf-rich-text="true"]').length===25,'Every styled cell remains editable rich text in preview');
 check(document.querySelector('main').innerHTML.includes('#D0D0D0'),'Preview contains imported corner color');
 const again=tableOf(await fromPptx(await toPptx(deck)));
 check(again.columns[0][0].color==='#D0D0D0'&&again.rows[0][1][0].italic===true,'Browser native re-export preserves effective formatting');
 out.textContent=JSON.stringify({passed:true,checks},null,2);document.title='PASS: native table styles';
} catch(error){out.textContent=error.stack;document.title='FAIL: native table styles';console.error(error);}
