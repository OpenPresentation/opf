// Current ordinary native body text only. This reader never reads OPF tags or
// recovers authoring boundaries across separate native text shapes.
import {XMLParser} from 'fast-xml-parser';
import {drawingObject, readSlideTheme} from './background-import.js';
import {nativeRunStyle, mergeNativeRunProperties} from './native-text-style.js';

const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', preserveOrder:true, parseAttributeValue:false, parseTagValue:false, trimValues:false, htmlEntities:true});
const nodes = (tree, tag) => (tree ?? []).filter(node => Object.hasOwn(node, tag));
const child = (tree, tag) => nodes(tree, tag)[0]?.[tag];
const text = tree => (tree ?? []).map(node => node['#text'] ?? '').join('');
// Match nativeTextShapes/nativeShapeParagraphs indexing; positional ordering is
// still performed by the existing slide importer, not by this reader.
const shapes = tree => [...nodes(tree, 'p:sp').map(node => node['p:sp']), ...nodes(tree, 'p:grpSp').flatMap(node => shapes(node['p:grpSp']))];
const LATIN_ONLY = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Z}]*$/u;
const value = runs => runs.some(run => typeof run !== 'string') ? runs : runs.join('');
export const joinNativeParagraphs = paragraphs => value(paragraphs.flatMap((paragraph, index) => [
  ...(index ? ['\n'] : []), ...(Array.isArray(paragraph.richText) ? paragraph.richText : [paragraph.richText ?? paragraph.text])
]));

function bodyRunStyle(properties, context, relationships, report) {
  const supported = {...properties};
  for (const key of ['b', 'i']) if (properties[key] !== undefined && !['1','0','true','false','on','off'].includes(properties[key])) {
    report('unsupported-body-text-style', `The native ${key} value is not a supported boolean; current text was retained.`);
    delete supported[key];
  }
  for (const [key, allowed] of [['u', ['none','sng']], ['strike', ['noStrike','sngStrike']]]) if (properties[key] !== undefined && !allowed.includes(properties[key])) {
    report('unsupported-body-text-style', `The native ${key} variant is not represented by an OPF boolean; current text was retained.`);
    delete supported[key];
  }
  if (properties.sz !== undefined && (!Number.isFinite(Number(properties.sz)) || Number(properties.sz) <= 0)) {
    report('unsupported-body-text-style', 'The native font size is not a positive finite value; current text was retained.');
    delete supported.sz;
  }
  if (properties.baseline !== undefined) {
    const baseline = Number(properties.baseline);
    if (!Number.isFinite(baseline)) {
      report('unsupported-body-text-style', 'The native baseline is not finite; current text was retained.');
      delete supported.baseline;
    } else if (![0,30000,-30000].includes(baseline)) {
      report('approximate-body-text-baseline', 'OPF retains the native baseline direction, but cannot represent its exact offset.');
    }
  }
  for (const key of ['a:latin','a:solidFill','a:hlinkClick']) if (Array.isArray(properties[key])) {
    report('unsupported-body-text-style', `Repeated native ${key} properties are ambiguous; current text was retained.`);
    delete supported[key];
  }
  for (const key of ['a:ea','a:cs','a:sym']) if (properties[key]?.typeface && properties[key].typeface !== properties['a:latin']?.typeface) {
    report('unsupported-body-font', 'Script-specific native faces cannot be represented by one OPF run font family; the Latin face and current text were retained.');
  }
  if (properties['a:hlinkMouseOver']) report('unsupported-body-link', 'A native mouse-over action cannot be represented by an OPF run URL.');
  if (['a:uLn', 'a:uFill', 'a:highlight', 'a:effectLst', 'a:effectDag', 'a:ln'].some(key => properties[key]) ||
    (properties.cap !== undefined && properties.cap !== 'none') || (properties.spc !== undefined && Number(properties.spc) !== 0)) {
    report('unsupported-body-text-style', 'Native text effects, capitalization, spacing or underline decoration are not represented by OPF run properties; current text was retained.');
  }
  return nativeRunStyle(supported, context, relationships, report, 'body');
}

export function nativeBodyReader(slidePath, archive, relationships, report) {
  let bodies, context;
  return index => {
    if (!bodies) {
      const tree = archive.part(slidePath, parser);
      bodies = shapes(child(child(child(tree, 'p:sld'), 'p:cSld'), 'p:spTree')).map(shape => child(shape, 'p:txBody'));
      context = readSlideTheme(slidePath, archive);
    }
    const body = bodies[index];
    if (!body) return undefined;
    const listStyle = drawingObject(child(body, 'a:lstStyle'));
    return nodes(body, 'a:p').map((paragraph, paragraphIndex) => {
      const content = paragraph['a:p'], pPr = drawingObject(child(content, 'a:pPr'));
      const level = Number(nodes(content, 'a:pPr')[0]?.[':@']?.lvl ?? 0) + 1;
      const defaults = mergeNativeRunProperties(listStyle['a:defPPr']?.['a:defRPr'], listStyle[`a:lvl${level}pPr`]?.['a:defRPr'], pPr['a:defRPr']);
      const runs = [];
      let runIndex = 0;
      for (const node of content) {
        const tag = ['a:r','a:fld','a:br'].find(name => Object.hasOwn(node, name));
        if (!tag) continue;
        const path = `shapes.${index}.paragraphs.${paragraphIndex}.runs.${runIndex++}`;
        const current = tag === 'a:br' ? '\n' : text(child(node[tag], 'a:t'));
        const properties = mergeNativeRunProperties(defaults, drawingObject(node[tag])['a:rPr']);
        // RR-05: a Latin phrase of a right-to-left paragraph is its own en-US run; its East Asian/complex-script slots can render nothing in it, so the face loss is not reported.
        const phrase = nodes(content, 'a:pPr')[0]?.[':@']?.rtl === '1' && properties.lang === 'en-US' && LATIN_ONLY.test(current);
        const style = bodyRunStyle(properties, context, relationships, (code, message) => { if (!(phrase && code === 'unsupported-body-font')) report({code,message,path}); });
        if (current) runs.push(Object.keys(style).length ? {text:current,...style} : current);
      }
      return {text:runs.map(run => typeof run === 'string' ? run : run.text).join(''), richText:value(runs)};
    });
  };
}
