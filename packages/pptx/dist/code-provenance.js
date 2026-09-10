import { XMLParser } from 'fast-xml-parser';

// Native shape tags are standard PresentationML customer data. Uppercase hex
// protects case-sensitive source from PowerPoint's case-insensitive Tags API.
const TAG = 'OPF_CODE_V1';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal:true});
const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false, trimValues:false});
const ordered = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false, trimValues:false, preserveOrder:true});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const hex = value => [...enc.encode(JSON.stringify(value))].map(byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase();
function unhex(value) {
  if (typeof value !== 'string' || !/^(?:[0-9A-Fa-f]{2})+$/.test(value)) throw new Error('Invalid code tag encoding.');
  return JSON.parse(dec.decode(Uint8Array.from(value.match(/../g),byte=>parseInt(byte,16))));
}

export function codeManifest(value, layout, group) {
  return {v:1, group, role:'panel', value, parts:layout.parts.map(part=>({role:part.role, generated:part.generated === true,
    lines:part.fit.sourceLines.map(({start,end,nextStart,boundary})=>({start,end,nextStart,boundary}))}))};
}

export function attachCodeTags(entries, records) {
  return attachTextTags(entries,records,TAG,'opfCode','code');
}

export {unhex as decodeTextTag};

export function attachTextTags(entries, records, tagName, prefix, kind) {
  if (!records.size) return;
  let count = 0;
  const seen = new Set(), types = [];
  for (const path of Object.keys(entries).filter(path=>/^ppt\/slides\/slide\d+\.xml$/.test(path)).sort()) {
    const relPath = path.replace('/slides/','/slides/_rels/') + '.rels';
    let rels = dec.decode(entries[relPath]);
    const ids = new Set([...rels.matchAll(/\bId="([^"]+)"/g)].map(match=>match[1]));
    const xml = dec.decode(entries[path]).replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape=>{
      const name = shape.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      if (!records.has(name)) return shape;
      if (seen.has(name)) throw new Error(`Duplicate generated ${kind} shape.`);
      seen.add(name);
      const part = `ppt/tags/${prefix}${++count}.xml`;
      let id = `rId${prefix[0].toUpperCase()+prefix.slice(1)}${count}`;
      while (ids.has(id)) id += '_';
      ids.add(id);
      entries[part] = enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:p="${NS}"><p:tag name="${tagName}" val="${hex(records.get(name))}"/></p:tagLst>`);
      types.push(`<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/>`);
      rels = rels.replace('</Relationships>',`<Relationship Id="${id}" Type="${REL}" Target="../tags/${prefix}${count}.xml"/></Relationships>`);
      shape = shape.replace(/<p:nvPr\s*\/>/,'<p:nvPr></p:nvPr>');
      if (!shape.includes('</p:nvPr>')) throw new Error(`Generated ${kind} shape has no native application properties.`);
      return shape.replace('</p:nvPr>',`<p:custDataLst><p:tags r:id="${id}"/></p:custDataLst></p:nvPr>`);
    });
    entries[path] = enc.encode(xml);
    entries[relPath] = enc.encode(rels);
  }
  if (seen.size !== records.size) throw new Error(`Missing generated ${kind} shapes.`);
  entries['[Content_Types].xml'] = enc.encode(dec.decode(entries['[Content_Types].xml']).replace('</Types>',types.join('')+'</Types>'));
}

const children = (nodes, name) => array(nodes).flatMap(node=>node[name] === undefined ? [] : [node[name]]);
const plainText = nodes => array(nodes).map(node=>node['#text'] ?? '').join('');
export const nativeTextShapes = tree => [...array(tree?.['p:sp']),...array(tree?.['p:grpSp']).flatMap(nativeTextShapes)];
const orderedShapes = tree => [...children(tree,'p:sp'),...children(tree,'p:grpSp').flatMap(orderedShapes)];
// Preserve the order of runs, fields and explicit line breaks. A keyed XML
// object groups all a:r before a:fld and cannot represent their original order.
export function nativeShapeParagraphs(xml) {
  const root = children(ordered.parse(xml),'p:sld')[0];
  const tree = children(children(root,'p:cSld')[0],'p:spTree')[0];
  return orderedShapes(tree).map(shape=>children(children(shape,'p:txBody')[0],'a:p').map(paragraph=>{
    let text = '', maxFontSize = 0, bullet = false, level = 0;
    for (const child of paragraph) {
      if (child['a:br'] !== undefined) text += '\n';
      for (const key of ['a:r','a:fld']) if (child[key] !== undefined) {
        text += children(child[key],'a:t').map(plainText).join('');
        for (const run of child[key]) {
          const size = Number(run[':@']?.sz);
          if (run['a:rPr'] !== undefined && Number.isFinite(size)) maxFontSize = Math.max(maxFontSize,size/100);
        }
      }
      if (child['a:pPr'] !== undefined) {
        level = Number(child[':@']?.lvl ?? 0);
        bullet = child['a:pPr'].some(node=>node['a:buChar'] !== undefined || node['a:buAutoNum'] !== undefined);
      }
    }
    return {text,maxFontSize,bullet,level};
  }));
}

function sourceFor(value, role, generated) {
  if (generated) return 'code';
  if (role === 'body') return typeof value === 'string' ? value : value.source;
  return value[role];
}

function validateManifest(manifest) {
  const {value,parts} = manifest;
  const object = value && typeof value === 'object' && !Array.isArray(value);
  if (typeof value !== 'string' && (!object || typeof value.source !== 'string' || Object.keys(value).some(key=>!['source','filename','language'].includes(key)) || ['filename','language'].some(key=>value[key] !== undefined && typeof value[key] !== 'string'))) throw new Error('Invalid source value.');
  // Empty metadata is preserved in the manifest but does not produce a label.
  const roles = [...(object && value.filename ? ['filename'] : []), ...(object && value.language ? ['language'] : []), 'body'];
  if (roles.length === 1) roles.unshift('language');
  if (!Array.isArray(parts) || parts.length !== roles.length) throw new Error('Invalid code parts.');
  parts.forEach((part,i)=>{
    const generated = roles.length === 2 && roles[0] === 'language' && !(object && (value.filename || value.language)) && i === 0;
    if (part.role !== roles[i] || part.generated !== generated || !Array.isArray(part.lines) || !part.lines.length) throw new Error('Invalid source part.');
    const source = sourceFor(value,part.role,generated);
    let cursor = 0;
    part.lines.forEach((line,index)=>{
      if (![line.start,line.end,line.nextStart].every(Number.isSafeInteger) || line.start !== cursor || line.end < line.start || line.nextStart < line.end || line.nextStart > source.length) throw new Error('Invalid source range.');
      const separator = source.slice(line.end,line.nextStart);
      const last = index === part.lines.length - 1;
      if (/\r|\n/.test(source.slice(line.start,line.end)) || (line.boundary === 'hard' ? !/^(?:\r\n|\r|\n)$/.test(separator) || last : separator !== '' || line.boundary !== (last ? 'end' : 'soft'))) throw new Error('Invalid source boundary.');
      cursor = line.nextStart;
    });
    if (cursor !== source.length) throw new Error('Incomplete source range.');
  });
}

// Only complete, unambiguous sets are coalesced. Visible text always wins over
// old source text; metadata supplies only source boundaries and payload roles.
export function importCodeGroups(shapes, paragraphs, relationships, entries, report) {
  const groups = new Map(), consumed = new Set(), items = [], tagCounts = new Map();
  for (const [index,shape] of shapes.entries()) {
    const links = array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags']);
    for (const link of links) {
      const rel = relationships.get(link['r:id']);
      if (rel?.type !== REL || rel.targetMode === 'External' || !rel.path || !entries[rel.path]) continue;
      let tags;
      try {
        const all=array(parser.parse(dec.decode(entries[rel.path]))['p:tagLst']?.['p:tag']);
        tagCounts.set(shape,(tagCounts.get(shape)??0)+all.filter(tag=>/^OPF_/i.test(tag.name)).length);
        tags=all.filter(tag=>tag.name?.toUpperCase()===TAG);
      }
      catch { report({code:'invalid-code-provenance',message:'Unreadable code tags; visible native shapes were retained.'}); continue; }
      for (const tag of tags) {
        try {
          const data = unhex(tag.val);
          if (data.v !== 1 || typeof data.group !== 'string' || !/^\d+$/.test(data.group)) throw new Error('Invalid code identity.');
          const group = groups.get(data.group) ?? [];
          group.push({data,shape,index,text:paragraphs[index].map(p=>p.text).join('\n')});groups.set(data.group,group);
        } catch { report({code:'invalid-code-provenance',message:'Invalid code tags; visible native shapes were retained.'}); }
      }
    }
  }
  for (const group of groups.values()) {
    try {
      if (group.some(item=>tagCounts.get(item.shape)!==1)) throw new Error('Multiple source identities on one shape.');
      const panels = group.filter(item=>item.data.role === 'panel');
      if (panels.length !== 1 || panels[0].text !== '') throw new Error('Missing, duplicated or edited panel.');
      const panel = panels[0], manifest = panel.data;
      validateManifest(manifest);
      const expectedCount = 1 + manifest.parts.reduce((sum,part)=>sum+part.lines.length,0);
      if (group.length !== expectedCount || new Set(group.map(item=>item.shape)).size !== group.length) throw new Error('Incomplete or duplicated code shapes.');
      const nativeLines = new Map();
      for (const item of group) if (item !== panel) {
        const {role,part,line} = item.data, key = `${part}:${line}`;
        if (role !== 'line' || !Number.isSafeInteger(part) || !Number.isSafeInteger(line) || !manifest.parts[part]?.lines[line] || nativeLines.has(key)) throw new Error('Ambiguous source line.');
        nativeLines.set(key,item.text);
      }
      const value = typeof manifest.value === 'string' ? {source:manifest.value} : {...manifest.value};
      for (const [partIndex,part] of manifest.parts.entries()) {
        const source = sourceFor(manifest.value,part.role,part.generated), newline = source.match(/\r\n|\r|\n/)?.[0] ?? '\n';
        let rebuilt = '';
        for (const [lineIndex,line] of part.lines.entries()) {
          const actual = nativeLines.get(`${partIndex}:${lineIndex}`);
          if (actual === undefined) throw new Error('Missing source line.');
          if (part.generated && actual !== source.slice(line.start,line.end)) throw new Error('Generated label was edited.');
          rebuilt += actual.replace(/\r\n|\r|\n/g,newline) + source.slice(line.end,line.nextStart);
        }
        if (!part.generated) value[part.role === 'body' ? 'source' : part.role] = rebuilt;
      }
      for (const item of group) consumed.add(item.shape);
      items.push({shape:panel.shape,payload:{type:'code',code:typeof manifest.value === 'string' ? value.source : value}});
      report({code:'code-import-reflow',message:'Code source boundaries and native text were recovered. Native positioning, formatting and font theme are not reconstructed; review the reflowed OPF.'});
    } catch (error) {
      report({code:'invalid-code-provenance',message:`${error.message} Visible native shapes were retained without restoring old source text.`});
    }
  }
  return {consumed,items};
}
