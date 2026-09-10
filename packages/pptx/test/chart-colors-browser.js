import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
import {renderSvg} from '@openpresentation/opf-render';
import {validatePresentation,colorContrast} from '@openpresentation/opf';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
const output=document.querySelector('pre');let checks=0;
const check=(ok,message)=>{if(!ok)throw Error(message);checks++;};
const chartOf=deck=>deck.slides[0].chart??deck.slides[0].blocks?.find(block=>block.chart)?.chart;
try{
 for(const type of ['column','pie'])for(const [background,surface,text]of [['#000000','#F8FAFC','#000000'],['#FFFFFF','#0F172A','#FFFFFF']]){
  const data={columns:[' Quarter & Ω\t\n ','Current'],rows:[['Q1',2],['Q2',3]]};
  const source={design:{background,colorScheme:{id:'cool-horizon',dark1:'#000000',light1:'#FFFFFF',dark2:surface,light2:surface}},slides:[{chart:{type,data}}]},before=JSON.stringify(source);
  const bytes=await toPptx(source),imported=await fromPptx(bytes);
  check(validatePresentation(imported).valid,'Reimport validates in the browser');
  check(JSON.stringify(chartOf(imported).data)===JSON.stringify(data),'Browser preserves exact heading, labels, series and values');
  document.querySelector('main').innerHTML=renderSvg(source,{trace:true});
  check(document.querySelector('rect[data-opf-path="slides.0.chart"]').getAttribute('fill')===surface,'SVG chart uses its resolved panel');
  check([...document.querySelectorAll('svg text')].every(label=>label.getAttribute('fill')===text),'Live SVG labels use the tested inherited color');
  const marks=[...document.querySelectorAll('[data-opf-path^="slides.0.chart.data"]')].filter(node=>['rect','path','circle','polyline'].includes(node.tagName));
  check(marks.length>0&&marks.every(mark=>colorContrast(mark.getAttribute('fill')==='none'?mark.getAttribute('stroke'):mark.getAttribute('fill'),surface)>=3),'Actual DOM series marks remain visible against the panel');
  // Change the actual workbook without changing OPF or adding source tags.
  const entries=unzipSync(bytes),part=Object.keys(entries).find(name=>name.startsWith('ppt/embeddings/')&&name.endsWith('.xlsx')),workbook=unzipSync(entries[part]);
  const sheet='xl/worksheets/sheet1.xml';workbook[sheet]=strToU8(strFromU8(workbook[sheet]).replace(/<c r="A1"[\s\S]*?<\/c>/,'<c r="A1" t="inlineStr"><is><t>Current workbook heading</t></is></c>'));
  entries[part]=zipSync(workbook);
  check(chartOf(await fromPptx(zipSync(entries))).data.columns[0]==='Current workbook heading','Import reads the current workbook header');
  check(JSON.stringify(source)===before,'Source input remains unchanged');
 }
 output.textContent=JSON.stringify({passed:true,checks,cases:4,scope:'Actual browser export/import, editable workbook heading recovery and DOM color observations; no native PowerPoint or raster-equivalence claim.'},null,2);
 document.title='PASS: chart colors';
}catch(error){output.textContent=error.stack;document.title='FAIL: chart colors';console.error(error);}
