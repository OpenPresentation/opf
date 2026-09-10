import {XMLParser} from 'fast-xml-parser';
import {validatePresentation} from '@openpresentation/opf';
import {attachTextTags,decodeTextTag} from './code-provenance.js';

const TAG='OPF_METRIC_V1',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decoder=new TextDecoder('utf-8',{fatal:true});
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const scalar=value=>typeof value==='string'||typeof value==='number';
const sourceFor=(value,role)=>scalar(value)?value:value[role];

// The first value line carries the complete manifest: no invisible panel is introduced.
export function metricManifest(value,layout,group) {
  return {v:1,group,role:'anchor',part:0,line:0,value,parts:layout.parts.map(part=>({role:part.role,visible:part.visible,
    lines:part.fit?.sourceLines.map(({start,end,nextStart,boundary})=>({start,end,nextStart,boundary}))??[]}))};
}
export function attachMetricTags(entries,records) {return attachTextTags(entries,records,TAG,'opfMetric','metric');}

function validateManifest(manifest) {
  if (!validatePresentation({slides:[{metric:manifest.value}]}).valid) throw new Error('Invalid metric source.');
  const roles=scalar(manifest.value)?['value']:['value','unit','label','description','delta','trend'].filter(role=>manifest.value[role]!==undefined);
  if (!Array.isArray(manifest.parts)||manifest.parts.length!==roles.length||manifest.part!==0||manifest.line!==0) throw new Error('Invalid metric parts.');
  for (const [index,part] of manifest.parts.entries()) {
    const source=String(sourceFor(manifest.value,roles[index])),visible=roles[index]==='value'||source.length>0;
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

export function importMetricGroups(shapes,paragraphs,relationships,entries,report) {
  const groups=new Map(),tagCounts=new Map(),consumed=new Set(),items=[];
  for (const [index,shape] of shapes.entries()) {
    for (const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
      const rel=relationships.get(link['r:id']);
      if (rel?.type!==REL||rel.targetMode==='External'||!rel.path||!entries[rel.path]) continue;
      let tags;
      try {
        const all=array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag']);
        tagCounts.set(shape,(tagCounts.get(shape)??0)+all.filter(tag=>[TAG,'OPF_CODE_V1'].includes(tag.name?.toUpperCase())).length);
        tags=all.filter(tag=>tag.name?.toUpperCase()===TAG);
      } catch {report({code:'invalid-metric-provenance',message:'Unreadable metric tags; visible native shapes were retained.'});continue;}
      for (const tag of tags) try {
        const data=decodeTextTag(tag.val);
        if (data.v!==1||typeof data.group!=='string'||!/^\d+$/.test(data.group)) throw new Error('Invalid metric identity.');
        const group=groups.get(data.group)??[];
        group.push({data,shape,text:(paragraphs[index]??[]).map(p=>p.text).join('\n')});groups.set(data.group,group);
      } catch {report({code:'invalid-metric-provenance',message:'Invalid metric tags; visible native shapes were retained.'});}
    }
  }
  for (const group of groups.values()) try {
    if (group.some(item=>tagCounts.get(item.shape)!==1)) throw new Error('Multiple source identities on one shape.');
    const anchors=group.filter(item=>item.data.role==='anchor');
    if (anchors.length!==1) throw new Error('Missing or duplicated metric anchor.');
    const anchor=anchors[0],manifest=anchor.data;validateManifest(manifest);
    const expected=manifest.parts.reduce((sum,part)=>sum+part.lines.length,0);
    if (group.length!==expected||new Set(group.map(item=>item.shape)).size!==expected) throw new Error('Incomplete or duplicated metric shapes.');
    const nativeLines=new Map();
    for (const item of group) {
      const {role,part,line}=item.data,key=`${part}:${line}`;
      if ((item!==anchor&&role!=='line')||!Number.isSafeInteger(part)||!Number.isSafeInteger(line)||!manifest.parts[part]?.lines[line]||nativeLines.has(key)) throw new Error('Ambiguous metric source line.');
      nativeLines.set(key,item.text);
    }
    const value=scalar(manifest.value)?{value:manifest.value}:{...manifest.value},typeChanges=[];
    for (const [partIndex,part] of manifest.parts.entries()) {
      if (!part.visible) continue;
      const original=sourceFor(manifest.value,part.role),source=String(original),newline=source.match(/\r\n|\r|\n/)?.[0]??'\n';
      let rebuilt='';
      for (const [lineIndex,line] of part.lines.entries()) {
        const actual=nativeLines.get(`${partIndex}:${lineIndex}`);
        if (actual===undefined) throw new Error('Missing metric source line.');
        rebuilt+=actual.replace(/\r\n|\r|\n/g,newline)+source.slice(line.end,line.nextStart);
      }
      // Preserve original types for unchanged text. Canonical finite numeric edits remain
      // numeric; other spellings become strings so no whitespace or precision is discarded.
      value[part.role]=typeof original==='number'&&rebuilt===source?original:
        typeof original==='number'&&Number.isFinite(Number(rebuilt))&&String(Number(rebuilt))===rebuilt?Number(rebuilt):rebuilt;
      if (typeof original!==typeof value[part.role]) typeChanges.push(part.role);
    }
    const metric=scalar(manifest.value)?value.value:value;
    if (!validatePresentation({slides:[{metric}]}).valid) throw new Error('Edited native text cannot form a valid metric.');
    for (const item of group) consumed.add(item.shape);
    items.push({shape:anchor.shape,payload:{type:'metric',metric}});
    if (typeChanges.length) report({code:'metric-value-type-changed',message:`Edited numeric ${typeChanges.join(', ')} retained as literal text to avoid discarding spelling or precision.`});
    report({code:'metric-import-reflow',message:'Metric fields, source boundaries and native text were recovered. Native formatting, positioning, alignment and font theme are not reconstructed; review the reflowed OPF.'});
  } catch (error) {report({code:'invalid-metric-provenance',message:`${error.message} Visible native shapes were retained without restoring old source text.`});}
  return {consumed,items};
}
