import {XMLParser} from 'fast-xml-parser';
import {checkFormat,isValidFormat} from './format-check.js';
import {attachTextTags,decodeTextTag,groupUnchanged} from './code-provenance.js';

const TAG='OPF_METRIC_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true});
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const scalar=value=>typeof value==='string'||typeof value==='number';
const sourceFor=(value,role)=>scalar(value)?value:value[role];

// RR-105: a number as the value or the delta is drawn with its thousands grouped by the slide's language (core groupNumber, LH-141):
// "1,500", "150 000" (U+202F), "150.000", "١٥٠٬٠٠٠". Its line ranges cover that text, which the record names (`text`, only when it is
// not String(number)). The import accepts a text only when it spells that very number (numberSpelling), whatever the runtime's locale data.
const DIGIT_ZEROS=[0x30,0x660,0x6F0,0x7C0,0x966,0x9E6,0xA66,0xAE6,0xB66,0xBE6,0xC66,0xCE6,0xD66,0xE50,0xED0,0xF20,0x1040,0x17E0,0x1810,0xFF10];
const SEPARATORS=new Set([',','.',"'",'’',' ',' ',' ',' ','٫','٬']);
const MARKS=/[؜‎‏‪-‮⁦-⁩]/g,MAX_SPELLING=64;
const digitOf=char=>{const code=char.codePointAt(0);for(const zero of DIGIT_ZEROS)if(code>=zero&&code<zero+10)return code-zero;return undefined;};
/**
 * How `text` spells a number: {value, decimal} (`decimal` the separator read as the decimal point, '' for none), or undefined when it is
 * not digits of one script with single group separators between them, at most one decimal separator and an optional leading minus
 * (bidi marks aside). `decimal` fixes the reading (an edited text is read the way its export was); without it, the reading that gives
 * `expected` wins, else the first. `groups` (with `decimal`) limits the group separators to the ones the export used.
 */
export function numberSpelling(text,{expected,decimal,groups}={}){
  if(typeof text!=='string'||!text||text.length>MAX_SPELLING)return undefined;
  const plain=text.replace(MARKS,''),negative=/^[-−]/.test(plain),chars=[...(negative?plain.slice(1):plain)];
  if(!chars.length||digitOf(chars[0])===undefined||digitOf(chars.at(-1))===undefined)return undefined;
  let zero;
  for(const [index,char] of chars.entries()){
    if(SEPARATORS.has(char)){if(SEPARATORS.has(chars[index+1])||groups&&char!==decimal&&!groups.has(char))return undefined;continue;}
    const digit=digitOf(char);if(digit===undefined)return undefined;
    const block=char.codePointAt(0)-digit;if(zero!==undefined&&zero!==block)return undefined;zero=block;
  }
  const read=point=>{
    if(point&&chars.filter(char=>char===point).length!==1)return undefined;
    let out='';for(const char of chars)out+=char===point?'.':SEPARATORS.has(char)?'':String(digitOf(char));
    const value=Number((negative?'-':'')+out);return Number.isFinite(value)?value:undefined;
  };
  const points=decimal!==undefined?[decimal]:['',...new Set(chars.filter(char=>SEPARATORS.has(char)))];
  for(const point of points){const value=read(point);if(value!==undefined&&(expected===undefined||Object.is(value,expected)||value===expected))return {value,decimal:point};}
  return undefined;
}
// An edited spelling of a number, read with the decimal and group separators of the spelling its export wrote.
function editedNumber(text,source,original){
  const reading=numberSpelling(source,{expected:original});
  if(!reading)return undefined;
  const groups=new Set([...source].filter(char=>SEPARATORS.has(char)&&char!==reading.decimal));
  return numberSpelling(text,{decimal:reading.decimal,groups});
}
const spelled=(role,original)=>(role==='value'||role==='delta')&&typeof original==='number';

// The first value line carries the complete manifest: no invisible panel is introduced.
// FR-06: `value` holds the 0.36 form of what is drawn (a 0.36.0 importer validates it as a metric and must read a plain one), and the
// 0.37 part (a data link, `better`, `format`, which keys were derived, the numbers behind formatted text) rides in the top-level `link`
// key, which that importer never reads.
// FR-07, part 3: `gauge` is the evidence of the gauge's native parts (addMetricGauge): [part, preset, adj1, adj2, fill] for each arc and
// the target's two end points in EMU. The gauge itself rides in `value`, the metric as authored.
export function metricManifest(value,layout,group,link,gauge) {
  return {v:1,group,role:'anchor',part:0,line:0,value,...(link?{link}:{}),...(gauge?{gauge}:{}),parts:layout.parts.map(part=>{const original=sourceFor(value,part.role);return {role:part.role,visible:part.visible,
    ...(spelled(part.role,original)&&typeof part.text==='string'&&part.text!==String(original)?{text:part.text}:{}),
    lines:part.fit?.sourceLines.map(({start,end,nextStart,boundary})=>({start,end,nextStart,boundary}))??[]};})};
}

// The text a part's line ranges cover: a number's spelling (the record's `text`; for a record without one, as v0.33.0 wrote, the native
// lines when they spell the number), else the source as written. A `text` that does not spell the number is a tampered record.
function partText(manifest,index,nativeLines){
  const part=manifest.parts[index],original=sourceFor(manifest.value,part?.role),plain=String(original);
  if(!spelled(part?.role,original)){if(part?.text!==undefined)throw new Error('Invalid metric display text.');return plain;}
  if(part.text!==undefined){if(!numberSpelling(part.text,{expected:original}))throw new Error('Invalid metric display text.');return part.text;}
  if(!Array.isArray(part.lines)||part.lines.at(-1)?.nextStart===plain.length)return plain;
  const joined=part.lines.map((_,line)=>nativeLines.get(`${index}:${line}`)??'').join('');
  return numberSpelling(joined,{expected:original})?joined:plain;
}
export function attachMetricTags(entries,records,descriptions) {return attachTextTags(entries,records,TAG,'opfMetric','metric',{descriptions,signed:true});}

function validateManifest(manifest,nativeLines=new Map()) {
  if (!isValidFormat({slides:[{metric:manifest.value}]})) throw new Error('Invalid metric source.');
  const roles=scalar(manifest.value)?['value']:['value','unit','label','description','delta','trend'].filter(role=>manifest.value[role]!==undefined);
  if (!Array.isArray(manifest.parts)||manifest.parts.length!==roles.length||manifest.part!==0||manifest.line!==0) throw new Error('Invalid metric parts.');
  for (const [index,part] of manifest.parts.entries()) {
    // LH-53: a trend is drawn as an arrow (the group's mark), so its part is not visible and has no lines; older exports drew its word.
    const source=partText(manifest,index,nativeLines),visible=roles[index]==='value'||String(sourceFor(manifest.value,roles[index])).length>0,arrow=roles[index]==='trend'&&part.role==='trend'&&part.visible===false;
    if (arrow) { if (!Array.isArray(part.lines)||part.lines.length) throw new Error('Invalid source part.'); continue; }
    if (part.role!==roles[index]||part.visible!==visible||!Array.isArray(part.lines)||visible&&!part.lines.length||!visible&&part.lines.length) throw new Error('Invalid source part.');
    let cursor=0;
    for (const [i,line] of part.lines.entries()) {
      if (![line.start,line.end,line.nextStart].every(Number.isSafeInteger)||line.start!==cursor||line.end<line.start||line.nextStart<line.end||line.nextStart>source.length) throw new Error('Invalid source range.');
      const separator=source.slice(line.end,line.nextStart),last=i===part.lines.length-1;
      if (/\r|\n/.test(source.slice(line.start,line.end))||(line.boundary==='hard'?!/^(?:\r\n|\r|\n)$/.test(separator)||last:separator!==''||line.boundary!==(last?'end':'soft'))) throw new Error('Invalid source boundary.');
      cursor=line.nextStart;
    }
    if (cursor!==source.length) throw new Error('Incomplete source range.');
  }
}

const DERIVED=['value','delta','trend','sentiment'];
// A metric fragment whose link names a dataset (or a column of one) that the fragment does not hold is not at fault: the datasets are
// restored with the document, and the finished document is checked whole.
const ONLY_IN_DOCUMENT=new Set(['opf/slide-link-unknown','opf/dataset-unknown','opf/dataset-field-unknown']);
const isValidMetric=metric=>!checkFormat({slides:[{metric}]}).findings.some(finding=>finding.severity==='error'&&!ONLY_IN_DOCUMENT.has(finding.ruleId));
const finite=number=>typeof number==='number'&&Number.isFinite(number);
// The link of a metric tag when it has the shape export writes and the 0.37 schema accepts with the drawn metric; undefined otherwise.
function readMetricLink(link,drawn) {
  if (!link||typeof link!=='object'||Array.isArray(link)) return undefined;
  const {data,better,format,derived,numbers,...rest}=link;
  if (Object.keys(rest).length||(data===undefined&&better===undefined&&format===undefined)) return undefined;
  if (derived!==undefined&&(!Array.isArray(derived)||derived.some(key=>!DERIVED.includes(key))||new Set(derived).size!==derived.length)) return undefined;
  if (numbers!==undefined&&(!numbers||typeof numbers!=='object'||Array.isArray(numbers)||Object.keys(numbers).some(key=>key!=='value'&&key!=='delta')||Object.values(numbers).some(number=>!finite(number)))) return undefined;
  const candidate={...drawn,...(data===undefined?{}:{data}),...(better===undefined?{}:{better}),...(format===undefined?{}:{format})};
  if (!isValidMetric(candidate)) return undefined;
  return {data,better,format,derived:derived??[],numbers:numbers??{}};
}
// The metric an unedited tag restores: the drawn form with the link, `better` and `format` back, the last computed numbers as the
// literal value and change, and a trend or sentiment that was derived (not typed) left to derive again.
function restoreMetricLink(drawn,link,edited) {
  // `format` goes where the written metric has it, right after `value`, so an unedited round trip keeps the key order.
  const metric={};
  for (const [key,entry] of Object.entries(drawn)) {
    metric[key]=entry;
    if (key==='value'&&link.format!==undefined) metric.format=link.format;
  }
  if (link.better!==undefined) metric.better=link.better;
  // The number behind a text stands for it only while what wrote the text is back too: the link (with its column's format) or the metric's format.
  if (link.numbers.value!==undefined&&!edited.has('value')&&(link.data||link.format!==undefined)) metric.value=link.numbers.value;
  if (link.numbers.delta!==undefined&&!edited.has('delta')&&(link.data||(link.format!==undefined&&!link.derived.includes('delta')))) metric.delta=link.numbers.delta;
  if (link.data) {
    metric.data=link.data;
    for (const key of ['trend','sentiment']) if (link.derived.includes(key)) delete metric[key];
  } else if (link.better!==undefined&&link.derived.includes('sentiment')) delete metric.sentiment;
  return metric;
}

const GAUGE_PART=/^gauge (?:track|band [1-6]|value|target|min|max)$/;
const gdValue=(shape,name)=>{const gd=array(shape?.['p:spPr']?.['a:prstGeom']?.['a:avLst']?.['a:gd']).find(entry=>entry?.name===name);const match=/^val (-?\d+)$/.exec(String(gd?.fmla??''));return match?Number(match[1]):undefined;};

/** The two end points of a straight line shape in EMU (its frame's corners, by its flips). */
function lineEnds(shape) {
  const xfrm=shape?.['p:spPr']?.['a:xfrm'],x=Number(xfrm?.['a:off']?.x),y=Number(xfrm?.['a:off']?.y),w=Number(xfrm?.['a:ext']?.cx),h=Number(xfrm?.['a:ext']?.cy);
  if (![x,y,w,h].every(Number.isFinite)) return undefined;
  const flipH=xfrm?.flipH==='1'||xfrm?.flipH==='true',flipV=xfrm?.flipV==='1'||xfrm?.flipV==='true';
  const [x1,x2]=flipH?[x+w,x]:[x,x+w],[y1,y2]=flipV?[y+h,y]:[y,y+h];
  return [x1,y1,x2,y2];
}
/** Whether every gauge part the manifest recorded is in the group, unedited: an arc's preset, angles and fill, the target's end points. */
function gaugeIntact(evidence,parts,fillOf) {
  if (!evidence||typeof evidence!=='object'||!Array.isArray(evidence.arcs)||!evidence.arcs.length) return false;
  const byPart=new Map(parts.map(item=>[item.data.part,item.shape]));
  for (const entry of evidence.arcs) {
    if (!Array.isArray(entry)||entry.length!==5) return false;
    const [part,preset,adj1,adj2,fill]=entry,shape=byPart.get(part);
    // An angle is the same modulo a full turn (PowerPoint reports 270 degrees as -90).
    const sameAngle=(value,recorded)=>value!==undefined&&Number.isFinite(recorded)&&((value-recorded)%21600000+21600000)%21600000===0;
    if (!shape||shape['p:spPr']?.['a:prstGeom']?.prst!==preset||!sameAngle(gdValue(shape,'adj1'),adj1)||!sameAngle(gdValue(shape,'adj2'),adj2)||String(fillOf(shape)??'').replace(/^#/,'').toUpperCase()!==String(fill).toUpperCase()) return false;
  }
  if (evidence.target!==undefined) {
    const ends=lineEnds(byPart.get('gauge target'));
    // A line runs between its two end points either way (PowerPoint writes a line by its frame and flips).
    const near=(points,index)=>Math.abs(points[index]-evidence.target[index])<=2;
    if (!ends||!Array.isArray(evidence.target)||evidence.target.length!==4) return false;
    if (![ends,[ends[2],ends[3],ends[0],ends[1]]].some(points=>points.every((_,index)=>near(points,index)))) return false;
  } else if (byPart.has('gauge target')) return false;
  return true;
}

export function importMetricGroups(shapes,paragraphs,relationships,entries,report,fillOf=shape=>shape?.['p:spPr']?.['a:solidFill']?.['a:srgbClr']?.val) {
  const groups=new Map(),tagCounts=new Map(),consumed=new Set(),items=[];
  for (const [index,shape] of shapes.entries()) {
    for (const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
      const rel=relationships.get(link['r:id']);
      if (rel?.type!==REL||rel.targetMode==='External'||!rel.path||!entries[rel.path]) continue;
      let tags;
      try {
        const all=array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']);
        tagCounts.set(shape,(tagCounts.get(shape)??0)+all.filter(tag=>/^OPF_/i.test(tag.name)).length);
        tags=all.filter(tag=>tag.name?.toUpperCase()===TAG);
      } catch {report({code:'invalid-metric-provenance',message:'Unreadable metric tags; visible native shapes were retained.'});continue;}
      for (const tag of tags) try {
        const data=decodeTextTag(tag.val);
        if (data.v!==1||typeof data.group!=='string'||!/^\d+$/.test(data.group)) throw new Error('Invalid metric identity.');
        const group=groups.get(data.group)??[];
        group.push({data,shape,index,text:(paragraphs[index]??[]).map(p=>p.text).join('\n')});groups.set(data.group,group);
      } catch {report({code:'invalid-metric-provenance',message:'Invalid metric tags; visible native shapes were retained.'});}
    }
  }
  for (const group of groups.values()) try {
    if (group.some(item=>tagCounts.get(item.shape)!==1)) throw new Error('Multiple source identities on one shape.');
    const anchors=group.filter(item=>item.data.role==='anchor');
    if (anchors.length!==1) throw new Error('Missing or duplicated metric anchor.');
    const anchor=anchors[0],manifest=anchor.data;
    if (!Array.isArray(manifest.parts)||!manifest.parts.every(part=>Array.isArray(part?.lines))) throw new Error('Invalid metric parts.');
    // RR-07: the trend arrow (role 'mark') is generated decoration, consumed with the group, never source text. LH-137: so is the delta's
    // pill (role 'pill'). FR-07, part 3: a metric has any number of marks, told apart by part name (the gauge's arcs, target and end labels;
    // the trend arrow has none): each part at most once.
    const marks=group.filter(item=>item.data.role==='mark'),pills=group.filter(item=>item.data.role==='pill'),members=group.filter(item=>item.data.role!=='mark'&&item.data.role!=='pill');
    const markPart=item=>item.data.part===undefined?'trend':item.data.part;
    if (marks.some(item=>item.data.part!==undefined&&!GAUGE_PART.test(item.data.part))) throw new Error('Unknown metric mark.');
    if (new Set(marks.map(markPart)).size!==marks.length) throw new Error('Duplicated metric mark.');
    if (pills.length>1) throw new Error('Duplicated metric delta pill.');
    const expected=manifest.parts.reduce((sum,part)=>sum+part.lines.length,0);
    if (members.length!==expected||new Set(members.map(item=>item.shape)).size!==expected) throw new Error('Incomplete or duplicated metric shapes.');
    const nativeLines=new Map();
    for (const item of members) {
      const {role,part,line}=item.data,key=`${part}:${line}`;
      if ((item!==anchor&&role!=='line')||!Number.isSafeInteger(part)||!Number.isSafeInteger(line)||!manifest.parts[part]?.lines[line]||nativeLines.has(key)) throw new Error('Ambiguous metric source line.');
      nativeLines.set(key,item.text);
    }
    validateManifest(manifest,nativeLines);
    const value=scalar(manifest.value)?{value:manifest.value}:{...manifest.value},typeChanges=[],changedRoles=new Set();
    for (const [partIndex,part] of manifest.parts.entries()) {
      if (!part.visible) continue;
      const original=sourceFor(manifest.value,part.role),source=partText(manifest,partIndex,nativeLines),newline=source.match(/\r\n|\r|\n/)?.[0]??'\n';
      let rebuilt='';
      for (const [lineIndex,line] of part.lines.entries()) {
        const actual=nativeLines.get(`${partIndex}:${lineIndex}`);
        if (actual===undefined) throw new Error('Missing metric source line.');
        rebuilt+=actual.replace(/\r\n|\r|\n/g,newline)+source.slice(line.end,line.nextStart);
      }
      // Preserve original types for unchanged text. Canonical finite numeric edits remain
      // numeric; other spellings become strings so no whitespace or precision is discarded.
      // A spelled number edited in place is read the way its export spelled it (the same decimal separator).
      const edited=typeof original==='number'&&source!==String(original)&&rebuilt!==source?editedNumber(rebuilt,source,original):undefined;
      value[part.role]=typeof original==='number'&&rebuilt===source?original:edited?edited.value:
        typeof original==='number'&&Number.isFinite(Number(rebuilt))&&String(Number(rebuilt))===rebuilt?Number(rebuilt):rebuilt;
      if (typeof original!==typeof value[part.role]) typeChanges.push(part.role);
      if (rebuilt!==source) changedRoles.add(part.role);
    }
    let metric=scalar(manifest.value)?value.value:value;
    // FR-06: the 0.37 part restores while the native evidence of the value and the change is unchanged.
    let link;
    if (manifest.link!==undefined) {
      link=readMetricLink(manifest.link,value);
      if (!link) report({code:'invalid-metric-provenance',message:'Invalid metric link; the metric was imported as drawn.'});
      else if (link.data&&(changedRoles.has('value')||changedRoles.has('delta'))) {
        const what=changedRoles.has('value')&&changedRoles.has('delta')?"value and change were":changedRoles.has('value')?'value was':'change was';
        report({code:'metric-data-dropped',message:`The metric's ${what} edited in PowerPoint, so its data link was not restored.`});
        link={...link,data:undefined};
      }
      if (link) metric=restoreMetricLink(value,link,changedRoles);
    }
    // FR-07, part 3: the gauge comes back while every part the manifest recorded still has its preset, angles and fill (and the target its
    // end points); otherwise the metric is restored without it and its remaining parts import as ordinary shapes.
    const gaugeParts=marks.filter(item=>item.data.part!==undefined);
    let gaugeKept=true;
    if (metric&&typeof metric==='object'&&metric.gauge!==undefined) {
      if (!gaugeIntact(manifest.gauge,gaugeParts,fillOf)) {
        gaugeKept=false;
        const {gauge:_dropped,...rest}=metric;metric=rest;
        report({code:'metric-gauge-not-restored',message:"The metric's gauge was edited, moved or deleted in PowerPoint, so the metric was restored without it; its remaining parts were imported as shapes."});
      }
    } else if (gaugeParts.length) gaugeKept=false;
    if (!isValidMetric(metric)) throw new Error('Edited native text cannot form a valid metric.');
    for (const item of group) if (gaugeKept||item.data.part===undefined||item.data.role!=='mark') consumed.add(item.shape);
    items.push({shape:anchor.shape,payload:{type:'metric',metric}});
    if (typeChanges.length) report({code:'metric-value-type-changed',message:`Edited numeric ${typeChanges.join(', ')} retained as literal text to avoid discarding spelling or precision.`});
    if(!groupUnchanged(group,paragraphs))report({code:'metric-import-reflow',message:'Metric fields, source boundaries and native text were recovered. Native formatting, positioning, alignment and font theme are not reconstructed; review the reflowed OPF.'});
  } catch (error) {report({code:'invalid-metric-provenance',message:`${error.message} Visible native shapes were retained without restoring old source text.`});}
  return {consumed,items};
}
