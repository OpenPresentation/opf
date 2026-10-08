// Browser public-entrypoint counterpart to the native-body Node fixture.
// Rendering uses browser-default measurement; physical fonts/native acceptance
// and exact authoring-source reconstruction remain separate gates.
import * as pptx from '@openpresentation/opf-pptx';
import {validate} from '@openpresentation/opf';
import * as render from '@openpresentation/opf-render';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {defaultCatalog} from '@openpresentation/opf/catalog';
// OPF 0.15: the gallery ids these documents name resolve from the registered default catalog (no built-in records).
const host = options => ({catalogs: [defaultCatalog], ...options});
const toPptx = (deck, options) => pptx.toPptx(deck, host(options)), fromPptx = (bytes, options) => pptx.fromPptx(bytes, host(options));
const renderSlideSvg = (deck, index, options) => render.renderSlideSvg(deck, index, host(options));
const output=document.querySelector('pre');
let checks=0;
const check=(condition,message)=>{if(!condition)throw new Error(message);checks++;};
const plain=value=>Array.isArray(value)?value.map(run=>typeof run==='string'?run:run.text).join(''):value;
// The root text payload returns as the slide's own field (content topology); blocks keep theirs.
const textBlocks=deck=>deck.slides[0].text!==undefined?[deck.slides[0].text]:deck.slides[0].blocks?.filter(block=>block.type==='text').map(block=>block.text)??[];
const at=(value,text)=>{check(Array.isArray(value),'Current native body remains rich');const run=value.find(run=>run.text===text);check(!!run,'Native run retained: '+JSON.stringify(text));return run;};
const part='ppt/slides/slide1.xml';
const options={seed:934,timestamp:'2026-09-29T12:00:00Z',zipDate:'2026-09-29T12:00:00Z'};
const observations=[];
try {
 for(const [mode,provenance] of [['full',undefined],['references-only','references-only'],['off',false]]) {
  const source={name:'Native browser body',description:' exact\r\n description ',design:{fontScheme:'roboto'},slides:[{title:'Current native formatting',notes:' exact\r\n notes\t ',text:[{text:'ORIGINAL_BODY',bold:true}]}]};
  const before=JSON.stringify(source),bytes=await toPptx(source,{...options,provenance});
  check(JSON.stringify(source)===before,'Export source is immutable');
  const body='<p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr><a:defRPr b="1" sz="2000"><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></a:lstStyle><a:p/><a:p><a:pPr><a:defRPr i="1"/></a:pPr><a:r><a:t> CURRENT </a:t></a:r><a:fld id="{00000000-0000-0000-0000-000000000001}" type="datetime"><a:rPr b="0" i="0" u="none" strike="noStrike" baseline="0"/><a:t>normal</a:t></a:fld><a:br/><a:r><a:rPr b="0" u="sng" strike="sngStrike" baseline="30000" sz="1800"><a:latin typeface="Cousine"/><a:solidFill><a:srgbClr val="2468AC"><a:alpha val="50000"/></a:srgbClr></a:solidFill><a:hlinkClick r:id="currentLink"/></a:rPr><a:t>\t linked &amp; current </a:t></a:r></a:p><a:p/></p:txBody>';
  const native=(replacement,remove=false)=>{
   const entries=unzipSync(bytes);let changed=0;
   entries[part]=strToU8(strFromU8(entries[part]).replace(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g,shape=>{
    if(!shape.includes('ORIGINAL_BODY'))return shape;check(!shape.includes('<p:tags '),'Native body is untagged');changed++;
    return remove?'':shape.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/,replacement);
   }));check(changed===1,'Exactly one native body is edited');
   const rel='ppt/slides/_rels/slide1.xml.rels';entries[rel]=strToU8(strFromU8(entries[rel]).replace('</Relationships>','<Relationship Id="currentLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/current" TargetMode="External"/></Relationships>'));
   return zipSync(entries,{mtime:new Date('2000-01-01T00:00:00Z'),level:0});
  };
  const diagnostics=[],current=native(body),copy=current.slice(),deck=await fromPptx(current,{onDiagnostic:d=>diagnostics.push(d)}),value=textBlocks(deck)[0];
  check(current.every((byte,index)=>byte===copy[index]),'Import input bytes remain immutable');
  check(validate(deck, {only: ['format']}).valid,'Imported browser document validates');
  check(deck.slides[0].title==='Current native formatting','Heading remains scalar and unchanged');
  check(deck.slides[0].notes===source.slides[0].notes&&deck.description===source.description,'Exact notes/description survive');
  check(plain(value)==='\n CURRENT normal\n\t linked & current \n','Ordered current run/field/break/blank/tab text');
  const inherited=at(value,' CURRENT ');check(inherited.bold&&inherited.italic&&inherited.fontSize===20&&inherited.fontFamily==='Roboto','Paragraph and theme font defaults');
  const normal=at(value,'normal');for(const key of ['bold','italic','underline','strikethrough','superscript','subscript'])check(normal[key]===false,'Explicit false '+key);
  const linked=at(value,'\t linked & current ');check(linked.bold===false&&linked.underline&&linked.strikethrough&&linked.superscript&&linked.fontSize===18&&linked.fontFamily==='Cousine'&&linked.color==='#2468AC80','Current native font/color/alpha/script');
  check(linked.link==='https://example.com/current','Current URL survives');
  check(!JSON.stringify(deck).includes('ORIGINAL_BODY'),'Old source text is not resurrected');
  check(!diagnostics.some(d=>d.code.startsWith('unsupported-body')),'Representable current properties need no unsupported-body diagnostic');
  const cleared=await fromPptx(native('<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>'));
  check(textBlocks(cleared)[0]==='','Cleared body is empty, not a shape label');
  const deleted=await fromPptx(native('',true));check(textBlocks(deleted).length===0,'Deleted body is not restored');
  const unstyled=await fromPptx(native('<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t> current&#13;\n&#9; &amp;#13; </a:t></a:r></a:p></p:txBody>'));
  check(textBlocks(unstyled)[0]===' current\r\n\t &#13; ','Numeric references and literal entity spelling stay current');
  document.querySelector('main').innerHTML=renderSlideSvg(deck, 0);
  check(document.querySelector('main').textContent.includes('CURRENT'),'Current imported body appears in preview');
  check(!!document.querySelector('main a[href="https://example.com/current"]'),'Current link appears in preview DOM');
  observations.push({mode,deck,diagnostics});
 }
 window.nativeBodyEvidence={observations,sourceAuthority:'current untagged native body',measurement:'browser-default; no physical font or Office claim'};
 output.textContent=JSON.stringify({passed:true,checks,modes:observations.map(x=>x.mode),measurement:window.nativeBodyEvidence.measurement},null,2);
 document.title='PASS: native body rich text';
} catch(error) {output.textContent=error.stack;document.title='FAIL: native body rich text';console.error(error);}
