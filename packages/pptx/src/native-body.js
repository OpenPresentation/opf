// RR-86 opt-in prototype. Native paragraphs trade measured line positions for a
// single editable body. No source words or per-line recovery tags are stored.
import {paragraphDirection, resolveTextStyle} from '@openpresentation/opf/composition';

const FIELDS = new Set(['text', 'items', 'bullets']);
const RUN_KEYS = new Set(['text', 'bold', 'italic', 'underline', 'strikethrough', 'color', 'fontFamily', 'fontSize', 'lang', 'link']);
const runsOf = value => typeof value === 'string' ? [{text: value}] : value;
const ownText = value => Array.isArray(value) ? value.map(run => typeof run === 'string' ? run : run?.text ?? '').join('') : value;
const richSupported = value => typeof value === 'string' || Array.isArray(value) && value.every(run => typeof run === 'string' || run && typeof run.text === 'string' && Object.keys(run).every(key => RUN_KEYS.has(key)) && (run.link === undefined || /^(https?:|mailto:|tel:)/i.test(run.link)));
// An LTR deck does not ask core for paragraph directions. Conservatively reject
// RTL letters anywhere (including an embedded phrase), using core's own script rule.
const hasRtl = text => [...text].some(char => /\p{L}/u.test(char) && paragraphDirection(char, 'rtl') === 'rtl');
const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));

/** Select at most one whole body. Other eligible-looking candidates fall back visibly. */
export function planNativeBody(slide, geometry, {automatic = false, report = () => {}} = {}) {
  const candidates = geometry.items.filter(item => FIELDS.has(item.field));
  const reject = (item, reason) => report({code: 'native-body-fallback', path: item.path, reason,
    message: `Native body export cannot represent this ${reason.replaceAll('-', ' ')}; the current measured shapes were exported.`});
  if (!candidates.length) return undefined;
  if (candidates.length > 1 || geometry.groups.length || automatic && geometry.items.filter(item => !['title', 'subtitle', 'tag'].includes(item.field)).length !== 1) {
    candidates.forEach(item => reject(item, 'complex-composition'));
    return undefined;
  }
  const [item] = candidates;
  const region = geometry.regions?.find(region => region.name === item.region);
  if (!/^slides\.\d+\.(?:blocks\.\d+\.)?(?:text|items|bullets)$/.test(item.path) || !automatic && (!region || region.collapsed || region.content.length !== 1 || region.overflow?.length) || item.frameBox) {
    reject(item, 'complex-composition'); return undefined;
  }
  if (item.listColumns?.length > 1) { reject(item, 'multi-column'); return undefined; }
  if (item.text?.overflow) { reject(item, 'overflow'); return undefined; }
  if (geometry.direction === 'rtl' || item.text?.directions?.includes('rtl')) { reject(item, 'unsupported-text'); return undefined; }
  const list = item.field !== 'text';
  let values;
  if (list) {
    const entries = item.text?.listEntries;
    if (item.payload?.numbering !== undefined || item.bulletImage || !entries?.length || entries.some(entry => entry.level !== 0 || entry.description) ||
      item.value.some(entry => entry && !Array.isArray(entry) && typeof entry === 'object' && Object.keys(entry).some(key => key !== 'text' && key !== 'level'))) {
      reject(item, 'unsupported-list'); return undefined;
    }
    values = item.value.map(entry => entry && !Array.isArray(entry) && typeof entry === 'object' ? entry.text : entry);
    if (values.some(value => /[\r\n]/.test(ownText(value)))) { reject(item, 'unsupported-list'); return undefined; }
  } else values = [item.value];
  if (values.some(value => !richSupported(value))) {
    reject(item, values.some(value => Array.isArray(value) && value.some(run => run?.cite !== undefined || run?.footnote !== undefined)) ? 'annotated-text' : 'unsupported-text');
    return undefined;
  }
  if (values.some(value => hasRtl(ownText(value)) || /\t|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(ownText(value))) || !values.some(value => ownText(value).length)) {
    reject(item, 'unsupported-text'); return undefined;
  }
  return {item, values, list, region: region?.name ?? 'Body', box: {...(region?.box ?? item.box)}, anchor: region?.anchor ?? 'top'};
}

/** Whole authored paragraphs, retaining hard breaks only. Styling uses selected native families. */
export function addNativeBody(slide, plan, context, options, helpers) {
  const {item, values, list, box, anchor} = plan;
  const base = item.textStyle;
  const baseFont = helpers.nativeFontOptions(base);
  const paragraphs = [];
  for (const value of values) {
    let paragraph = [];
    paragraphs.push(paragraph);
    for (const source of runsOf(value)) {
      const run = typeof source === 'string' ? {text: source} : source;
      const style = resolveTextStyle({...base, fontFamily: run.fontFamily ?? base.fontFamily,
        fontWeight: run.bold === undefined ? base.fontWeight : run.bold ? 700 : 400, italic: run.italic ?? base.italic}, options.textMeasurement);
      const hex = helpers.exportColor(run.color, context, context.colors.text);
      const color = helpers.linkColor(run, helpers.nativeColor(run.color, hex, context, context.textColor), context);
      const runOptions = {...helpers.nativeFontOptions(style), fontSize: run.fontSize ?? item.text.fontSize * .75,
        color, transparency: hex.length === 8 ? (1 - parseInt(hex.slice(6), 16) / 255) * 100 : 0,
        underline: run.underline ? {style: 'sng', color} : {style: 'none'}, strike: run.strikethrough ? 'sngStrike' : undefined,
        hyperlink: run.link && /^(https?:|mailto:|tel:)/i.test(run.link) ? {url: run.link} : undefined, ...helpers.langOptions(context, run.lang)};
      const pieces = run.text.split(/\r\n|\r|\n/);
      pieces.forEach((text, index) => {
        if (index) { paragraph = []; paragraphs.push(paragraph); }
        paragraph.push({text, options: {...runOptions}});
      });
    }
  }
  const indent = list ? item.text.listEntries[0].marker.indent * .75 : undefined;
  const paragraphOptions = list ? {bullet: {characterCode: '2022', indent}, hanging: indent / 4, indentLevel: 0} : {bullet: false};
  const runs = paragraphs.flatMap((paragraph, index) => {
    if (!paragraph.length) paragraph = [{text: '', options: {}}];
    return paragraph.map((run, position) => ({...run, options: {...run.options, ...paragraphOptions,
      breakLine: position === paragraph.length - 1 && index < paragraphs.length - 1}}));
  });
  const objectName = `OPF native body ${item.path}`;
  slide.addText(runs, {...helpers.textBoxOptions({x: box.x / 96, y: box.y / 96, w: box.width / 96, h: box.height / 96}, context, item.text.fontSize * .75),
    ...baseFont, ...paragraphOptions, objectName, align: item.alignment ?? 'left', valign: {top: 'top', middle: 'mid', bottom: 'bottom'}[anchor],
    fit: 'none', wrap: true, lineSpacingMultiple: 1.22, bold: false, italic: false});
  // Defaults for blank/appended paragraphs must name the selected family too.
  const defaults = `<a:defRPr sz="${Math.round(item.text.fontSize * 75)}" b="${baseFont.bold ? 1 : 0}" i="${baseFont.italic ? 1 : 0}"><a:solidFill>${helpers.solidColorXml(context.textColor)}</a:solidFill><a:latin typeface="${escapeXml(baseFont.fontFace)}"/></a:defRPr>`;
  return {objectName, defaults};
}

/** Only prototype objects receive explicit no-autofit and paragraph typing defaults. */
export function nativeBodyDefaults(xml, records) {
  if (!records?.size) return xml;
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
    const name = shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1];
    const defaults = records.get(name);
    if (!defaults) return shape;
    shape = shape.replace(/(<a:bodyPr\b[^>]*>)[\s\S]*?<\/a:bodyPr>/, '$1<a:noAutofit/></a:bodyPr>');
    const pPr = shape.match(/<a:pPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:pPr>)/)?.[0] ?? '<a:pPr/>';
    const paragraphDefault = pPr.replace(/<a:pPr\b/, '<a:defPPr').replace(/<\/a:pPr>/, '</a:defPPr>').replace(/<a:defRPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:defRPr>)/g, '');
    const withDefaults = paragraphDefault.endsWith('/>') ? paragraphDefault.slice(0, -2) + `>${defaults}</a:defPPr>` : paragraphDefault.replace('</a:defPPr>', `${defaults}</a:defPPr>`);
    shape = shape.replace(/<a:lstStyle\s*\/>/, `<a:lstStyle>${withDefaults}</a:lstStyle>`);
    return shape.replace(/<a:endParaRPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:endParaRPr>)/g, defaults.replaceAll('a:defRPr', 'a:endParaRPr'));
  });
}
