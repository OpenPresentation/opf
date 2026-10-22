// Current ordinary native body text only. This reader never reads OPF tags or
// recovers authoring boundaries across separate native text shapes.
import {XMLParser} from 'fast-xml-parser';
import {drawingObject, readSlideTheme} from './background-import.js';
import {readBackgroundColor} from './background.js';
import {nativeRunStyle, mergeNativeRunProperties, nativeTypeface} from './native-text-style.js';

const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', preserveOrder:true, parseAttributeValue:false, parseTagValue:false, trimValues:false, htmlEntities:true});
const nodes = (tree, tag) => (tree ?? []).filter(node => Object.hasOwn(node, tag));
const child = (tree, tag) => nodes(tree, tag)[0]?.[tag];
const text = tree => (tree ?? []).map(node => node['#text'] ?? '').join('');
// Match nativeTextShapes/nativeShapeParagraphs indexing; positional ordering is
// still performed by the existing slide importer, not by this reader.
const shapes = tree => [...nodes(tree, 'p:sp').map(node => node['p:sp']), ...nodes(tree, 'p:grpSp').flatMap(node => shapes(node['p:grpSp']))];
const LATIN_ONLY = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Z}]*$/u;
const value = runs => runs.some(run => typeof run !== 'string') ? runs : runs.join('');
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const bulletKeys = ['a:buNone', 'a:buChar', 'a:buBlip', 'a:buAutoNum'];

// Only current, unambiguous body-placeholder bindings can inherit styles.
// Undefined is an ordinary text box; null is an unresolved Body binding.
function bodyInheritedStyles(shape, context, archive, slidePath) {
  const ph = drawingObject(child(shape, 'p:nvSpPr'))['p:nvPr']?.['p:ph'];
  if (!ph || Array.isArray(ph) || ph.type !== 'body') return undefined;
  const placeholder = (root, reference) => {
    const candidates = array(root?.['p:cSld']?.['p:spTree']?.['p:sp']).filter(shape => {
      const current = shape['p:nvSpPr']?.['p:nvPr']?.['p:ph'];
      return current && !Array.isArray(current) && current.type === 'body' && String(current.idx ?? '0') === String(reference.idx ?? '0');
    });
    return candidates.length === 1 ? candidates[0] : undefined;
  };
  const related = (part, type) => [...archive.relationships(part).values()].filter(rel => rel.type.endsWith('/' + type));
  const layouts = related(slidePath, 'slideLayout');
  if (layouts.length !== 1 || layouts[0].targetMode === 'External') return null;
  const masters = related(layouts[0].path, 'slideMaster');
  if (masters.length !== 1 || masters[0].targetMode === 'External') return null;
  const layout = context.chain.find(part => part.path === layouts[0].path)?.root;
  const master = context.chain.find(part => part.path === masters[0].path)?.root;
  if (!layout || !master) return null;
  const layoutShape = placeholder(layout, ph);
  if (!layoutShape) return null;
  const masterShape = placeholder(master, layoutShape['p:nvSpPr']['p:nvPr']['p:ph']);
  if (!masterShape) return null;
  return [layoutShape['p:txBody']?.['a:lstStyle'], masterShape?.['p:txBody']?.['a:lstStyle'], master['p:txStyles']?.['p:bodyStyle']];
}

function inheritedRunDefaults(styles, level) {
  if (!styles || !Number.isInteger(level) || level < 1 || level > 9) return undefined;
  const levels = [...styles].reverse().flatMap(style => [style?.['a:defPPr'], style?.[`a:lvl${level}pPr`]]);
  if (styles.some(Array.isArray) || levels.some(value => Array.isArray(value) || Array.isArray(value?.['a:defRPr']))) return undefined;
  return mergeNativeRunProperties(...levels.map(value => value?.['a:defRPr']));
}
export const joinNativeParagraphs = paragraphs => value(paragraphs.flatMap((paragraph, index) => [
  ...(index ? ['\n'] : []), ...(Array.isArray(paragraph.richText) ? paragraph.richText : [paragraph.richText ?? paragraph.text])
]));

// FA-13: a run language that differs from the deck language comes back as TextRun.lang; a run in the design's code family
// comes back as an inline code run. `extras` is {deckLang, codeFamily} (either may be absent).
const RUN_LANG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
function bodyRunStyle(properties, context, relationships, report, extras = {}) {
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
  const latin = nativeTypeface(properties['a:latin']?.typeface, context)?.trim().toLowerCase();
  for (const key of ['a:ea','a:cs','a:sym']) if (properties[key]?.typeface && (extras.inheritedBody
    ? !latin || nativeTypeface(properties[key].typeface, context)?.trim().toLowerCase() !== latin
    : properties[key].typeface !== properties['a:latin']?.typeface)) {
    report('unsupported-body-font', 'Script-specific native faces cannot be represented by one OPF run font family; the Latin face and current text were retained.');
  }
  if (properties['a:hlinkMouseOver']) report('unsupported-body-link', 'A native mouse-over action cannot be represented by an OPF run URL.');
  if (['a:uLn', 'a:uFill', 'a:highlight', 'a:effectLst', 'a:effectDag', 'a:ln'].some(key => properties[key]) ||
    (properties.cap !== undefined && properties.cap !== 'none') || (properties.spc !== undefined && Number(properties.spc) !== 0)) {
    report('unsupported-body-text-style', 'Native text effects, capitalization, spacing or underline decoration are not represented by OPF run properties; current text was retained.');
  }
  const style = nativeRunStyle(supported, context, relationships, report, 'body');
  const lang = properties.lang;
  if (extras.deckLang && typeof lang === 'string' && RUN_LANG.test(lang) && !/^(?:und|zxx)(?:-|$)/i.test(lang) && lang.toLowerCase() !== extras.deckLang.toLowerCase()) style.lang = lang;
  const family = typeof style.fontFamily === 'string' ? style.fontFamily.trim().toLowerCase() : undefined;
  if (family && extras.codeFamily && family === extras.codeFamily.trim().toLowerCase()
    && !['a:majorFont', 'a:minorFont'].some(key => context.fonts?.[key]?.['a:latin']?.typeface?.trim().toLowerCase() === family)) {
    style.code = true;
    delete style.fontFamily;
  }
  return style;
}

export function nativeBodyReader(slidePath, archive, relationships, report, extras = {}) {
  let bodies, context, inheritedStyles;
  return index => {
    if (!bodies) {
      const tree = archive.part(slidePath, parser);
      const currentShapes = shapes(child(child(child(tree, 'p:sld'), 'p:cSld'), 'p:spTree'));
      bodies = currentShapes.map(shape => child(shape, 'p:txBody'));
      context = readSlideTheme(slidePath, archive);
      inheritedStyles = currentShapes.map(shape => bodyInheritedStyles(shape, context, archive, slidePath));
    }
    const body = bodies[index];
    if (!body) return undefined;
    const listStyle = drawingObject(child(body, 'a:lstStyle'));
    return nodes(body, 'a:p').map((paragraph, paragraphIndex) => {
      const content = paragraph['a:p'], pPr = drawingObject(child(content, 'a:pPr'));
      const level = Number(nodes(content, 'a:pPr')[0]?.[':@']?.lvl ?? 0) + 1;
      const inheritedBody = inheritedStyles[index] !== undefined;
      const defaults = mergeNativeRunProperties(inheritedRunDefaults(inheritedStyles[index], level), listStyle['a:defPPr']?.['a:defRPr'], listStyle[`a:lvl${level}pPr`]?.['a:defRPr'], pPr['a:defRPr']);
      // Membership alone follows native paragraph/shape/layout/master precedence.
      // A local buNone cancels all
      // inherited bullets; missing bindings never recover stored source words.
      const inherited = Number.isInteger(level) && level >= 1 && level <= 9 ? inheritedStyles[index] ?? [] : [];
      const bulletProperties = [pPr, listStyle[`a:lvl${level}pPr`], listStyle['a:defPPr'],
        ...inherited.flatMap(style => [style?.[`a:lvl${level}pPr`], style?.['a:defPPr']])]
        .find(properties => properties && !Array.isArray(properties) && bulletKeys.some(key => Object.hasOwn(properties, key)));
      const membership = bulletProperties ? {bullet: !Object.hasOwn(bulletProperties, 'a:buNone'), level: level - 1,
        ...(bulletProperties['a:buAutoNum'] ? {autoNum: {type: bulletProperties['a:buAutoNum'].type, startAt: bulletProperties['a:buAutoNum'].startAt}} : {})} : {};
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
        const style = bodyRunStyle(properties, context, relationships, (code, message) => { if (!(phrase && code === 'unsupported-body-font')) report({code,message,path}); }, {...extras, inheritedBody, ...(phrase ? {deckLang: undefined} : {})});
        // Supported canonical forms may intentionally omit a resolved family
        // (code:true) or the resolved theme hyperlink color (link without color).
        const resolvedFill = style.color !== undefined || style.link && properties['a:solidFill'] && readBackgroundColor(properties['a:solidFill'], context);
        if (current && inheritedBody && (!(style.fontFamily || style.code) || style.fontSize === undefined || !resolvedFill)) report({code: 'unsupported-body-inherited-style', path,
          message: 'The current Body font family, point size or fill could not be fully resolved from its explicit styles and unambiguous layout/master cascade; current text was retained.'});
        if (current) runs.push(Object.keys(style).length ? {text:current,...style} : current);
      }
      return {text:runs.map(run => typeof run === 'string' ? run : run.text).join(''), richText:value(runs), ...membership};
    });
  };
}
