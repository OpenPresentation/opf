import {fromPptx,toPptx} from '@openpresentation/opf-pptx';
import {renderSvg} from '@openpresentation/opf-render';
import {unzipSync,zipSync} from 'fflate';
const out=document.querySelector('pre');
let cases=0;
const check=(condition,message)=>{if(!condition)throw new Error(message);cases++;};
const text=cell=>Array.isArray(cell)?cell.map(run=>typeof run==='string'?run:run.text).join(''):cell;
try {
 const source={slides:[{table:{columns:[[{text:'Normal ',bold:false},{text:'bold',bold:true}],'Value'],rows:[
  [[{text:'Native rich text',bold:true,italic:true,color:'#2468AC',fontSize:18,fontFamily:'Georgia',link:'https://example.com'}],'Plain'],
  [['\nStart\n',{text:'\nEnd\n',bold:true}],[]]
 ]}}]};
 const bytes=await toPptx(source),deck=await fromPptx(bytes),table=deck.slides[0].blocks.find(block=>block.table).table;
 check(table.columns[0][0].bold===false,'Normal native header');
 check(table.columns[0][1].bold===true,'Bold native header');
 const run=table.rows[0][0][0];
 check(run.bold&&run.italic&&run.color==='#2468AC'&&run.fontSize===18&&run.fontFamily==='Georgia','Native character formatting');
 check(run.link==='https://example.com','Native hyperlink');
 check(text(table.rows[1][0])==='\nStart\n\nEnd\n','Blank paragraphs and whitespace');
 check(table.rows[1][1]==='','Empty native cell');
 const again=await fromPptx(await toPptx(deck));
 check(text(again.slides[0].blocks[0].table.rows[1][0])===text(table.rows[1][0]),'Repeated conversion');
 const entries=unzipSync(bytes),path='ppt/slides/slide1.xml';
 entries[path]=new TextEncoder().encode(new TextDecoder().decode(entries[path]).replace(/<a:txBody>[\s\S]*?<\/a:txBody>/,'<a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t> A </a:t></a:r><a:fld><a:t>7</a:t></a:fld><a:br/><a:r><a:t> B </a:t></a:r></a:p><a:p/></a:txBody>'));
 const edited=await fromPptx(zipSync(entries));
 check(text(edited.slides[0].blocks[0].table.columns[0])===' A 7\n B \n','Native run/field/break order');
 const diagnostics=[];
 document.querySelector('main').innerHTML=renderSvg(deck,{trace:true,onDiagnostic:d=>diagnostics.push(d)});
 check(diagnostics.some(d=>d.code==='text-overflow'),'Multiline table overflow remains reported');
 check(!!document.querySelector('a[href="https://example.com"]'),'Imported hyperlink preview');
 out.textContent=JSON.stringify({passed:true,cases,visualLimitation:'Fixed-height table rows overflow for preserved multiline content; layout diagnostic confirmed.',checks:'Native XML import, style/default preservation, links, blank lines, repeated conversion and SVG preview'},null,2);
 document.title='PASS: native rich table import';
} catch(error) {out.textContent=error.stack;document.title='FAIL: native rich table import';}
