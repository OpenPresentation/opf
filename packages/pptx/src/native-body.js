// RR-86 opt-in prototype. Native paragraphs trade measured line positions for a
// single editable body. No source words or per-line recovery tags are stored.
import {bindNoBreak, paragraphDirection, resolveTextStyle, textWidthMeasurer} from '@openpresentation/opf/composition';
import {autoNumScheme} from './numbered-list.js';

const FIELDS = new Set(['text', 'items', 'bullets']);
const RUN_KEYS = new Set(['text', 'bold', 'italic', 'underline', 'strikethrough', 'color', 'fontFamily', 'fontSize', 'lang', 'link']);
const runsOf = value => typeof value === 'string' ? [{text: value}] : value;
const ownText = value => Array.isArray(value) ? value.map(run => typeof run === 'string' ? run : run?.text ?? '').join('') : value;
const richSupported = value => typeof value === 'string' || Array.isArray(value) && value.every(run => typeof run === 'string' || run && typeof run.text === 'string' && Object.keys(run).every(key => RUN_KEYS.has(key)) && (run.link === undefined || /^(https?:|mailto:|tel:)/i.test(run.link)));
// An LTR deck does not ask core for paragraph directions. Conservatively reject
// RTL letters anywhere (including an embedded phrase), using core's own script rule.
const hasRtl = text => [...text].some(char => /\p{L}/u.test(char) && paragraphDirection(char, 'rtl') === 'rtl');
const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));

/**
 * Plan the native bodies of one slide: every text, list or bullets item that can be one editable body, in composition order.
 * The first is returned with the rest as `others`; the first alone binds to the Body placeholder, each other one is an ordinary
 * native text box at its region (RR-88). An item that cannot be a native body falls back to measured shapes with a visible diagnostic.
 */
export function planNativeBody(slide, geometry, {automatic = false, report = () => {}, textMeasurement} = {}) {
  const candidates = geometry.items.filter(item => FIELDS.has(item.field));
  const reject = (item, reason) => report({code: 'native-body-fallback', path: item.path, reason,
    message: `Native body export cannot represent this ${reason.replaceAll('-', ' ')}; the current measured shapes were exported.`});
  if (!candidates.length) return undefined;
  if (geometry.groups.length) {
    candidates.forEach(item => reject(item, 'complex-composition'));
    return undefined;
  }
  const plans = [];
  for (const item of candidates) {
    const plan = planOne(item, geometry, automatic, reason => reject(item, reason), textMeasurement);
    if (plan) plans.push(plan);
  }
  return plans.length ? {...plans[0], others: plans.slice(1)} : undefined;
}

function planOne(item, geometry, automatic, reject, textMeasurement) {
  const region = geometry.regions?.find(region => region.name === item.region);
  if (!/^slides\.\d+\.(?:blocks\.\d+\.|[A-Za-z][A-Za-z0-9+_-]*\.)?(?:text|items|bullets)$/.test(item.path) || !automatic && (!region || region.collapsed || region.content.length !== 1 || region.overflow?.length)) {
    reject('complex-composition'); return undefined;
  }
  // LH-50: a label core draws as an eyebrow, and the paragraph under it, keep their measured shapes: a native body at the region would
  // start its text over the eyebrow.
  const at = geometry.items.indexOf(item);
  if (item.eyebrow || geometry.items[at - 1]?.eyebrow) { reject('complex-composition'); return undefined; }
  if (item.listColumns?.length > 1) { reject('multi-column'); return undefined; }
  if (item.text?.overflow) { reject('overflow'); return undefined; }
  if (geometry.direction === 'rtl' || item.text?.directions?.includes('rtl')) { reject('unsupported-text'); return undefined; }
  const list = item.field !== 'text';
  let values, numbering;
  if (list) {
    const entries = item.text?.listEntries;
    // LH-07: entries drawn beside step badges sit at core's measured lines, which native paragraphs (PowerPoint's own wrap) cannot promise.
    if (entries?.some(entry => entry.badge)) { reject('step-badges'); return undefined; }
    if (item.bulletImage || !entries?.length || entries.some(entry => entry.level !== 0 || entry.description || entry.marker?.none) ||
      item.value.some(entry => entry && !Array.isArray(entry) && typeof entry === 'object' && Object.keys(entry).some(key => key !== 'text' && key !== 'level'))) {
      reject('unsupported-list'); return undefined;
    }
    if (item.payload?.numbering !== undefined) {
      // One native numbered sequence: every entry has a number of one style and suffix, counting up from the first by one.
      numbering = nativeNumbering(entries);
      if (!numbering) { reject('unsupported-list'); return undefined; }
    }
    values = item.value.map(entry => entry && !Array.isArray(entry) && typeof entry === 'object' ? entry.text : entry);
    if (values.some(value => /[\r\n]/.test(ownText(value)))) { reject('unsupported-list'); return undefined; }
  } else values = [item.runs ?? item.value]; // LH-63: a run-in heading's bold first words are runs
  if (values.some(value => !richSupported(value))) {
    reject(values.some(value => Array.isArray(value) && value.some(run => run?.cite !== undefined || run?.footnote !== undefined)) ? 'annotated-text' : 'unsupported-text');
    return undefined;
  }
  if (values.some(value => hasRtl(ownText(value)) || /\t|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(ownText(value))) || !values.some(value => ownText(value).length)) {
    reject('unsupported-text'); return undefined;
  }
  // A block on a card (LH-22) is a native text box at its place inside the card, never bound to the Body placeholder: Change Layout
  // would move it away from its card, as it would a carded picture.
  // RR-105 (opf#1089): PowerPoint wraps the body itself, so its box must keep core's lines whole (see nativeWrapBox); a body whose lines
  // PowerPoint could break differently at any width keeps its measured shapes.
  const limits = item.frameBox ? {left: item.frameBox.x + CARD_BORDER, right: item.frameBox.x + item.frameBox.width - CARD_BORDER} : {left: 0, right: geometry.width ?? Infinity};
  const wrap = nativeWrapBox(item, values, list, limits, textMeasurement);
  if (!wrap) { reject('tight-wrap'); return undefined; }
  if (item.frameBox) return {item, values, list, ...(numbering ? {numbering} : {}), region: region?.name ?? 'Body', box: {...item.box}, anchor: 'top', carded: true, wrap};
  // LH-48: core sets a lone block that fills too little of the body in the middle of its region; the placeholder anchors it there too.
  const centered = region && item.box.height < region.box.height - 1 && Math.abs(item.box.y + item.box.height / 2 - (region.box.y + region.box.height / 2)) < 1;
  return {item, values, list, ...(numbering ? {numbering} : {}), region: region?.name ?? 'Body', box: {...(region?.box ?? item.box)}, anchor: centered ? 'middle' : region?.anchor ?? 'top', wrap};
}

// RR-105 (opf#1089). PowerPoint's advances and kerning differ from core's measurement by a fraction of a percent, so a native body written
// at exactly core's wrap width broke a line core measured as fitting (layout-sampler slide 41: a line 0.45 px inside its 483.55 px box
// wrapped to two lines and ran out of its card), and a body written at its region's width (wider than core's measure) or holding lines
// core balanced could take up a word that core put on the next line. In the native box every line keeps WRAP_MARGIN of core's wrap width
// free, and every soft break overruns the box by at least as much: core's line plus the first unit of the next line does not fit.
export const WRAP_MARGIN = .01;
const CARD_BORDER = 1; // px: the card's outline (0.75 pt) is its inner edge
// A space PowerPoint may break at: whitespace other than the no-break spaces (bindNoBreak writes U+00A0).
const BREAKABLE = /[^\S  ﻿]/u;
const HYPHEN = /[-‐‒–—]/u;

/**
 * The text of a planned native body, paragraph by paragraph, with core's lines as ranges of each paragraph and a measurer of the runs as
 * PowerPoint receives them (no-break spaces bound, each run in its own face and written size). Undefined when core's lines are not the
 * paragraphs' text (nothing can then be verified).
 */
export function nativeBodyLines(item, values, list, textMeasurement) {
  const base = item.textStyle, measurers = new Map();
  const measurer = run => {
    const style = resolveTextStyle({...base, fontFamily: run.fontFamily ?? base.fontFamily,
      fontWeight: run.bold === undefined ? base.fontWeight : run.bold ? 700 : 400, italic: run.italic ?? base.italic}, textMeasurement);
    const key = `${style.fontFamily}|${style.fontWeight}|${style.italic ? 1 : 0}`;
    if (!measurers.has(key)) measurers.set(key, textWidthMeasurer(style, textMeasurement));
    return measurers.get(key);
  };
  const paragraphs = [];
  const source = (value, lines) => {
    // One value: its runs (bound as written) and its lines; a text value's hard breaks start new paragraphs.
    const authored = runsOf(value).map(entry => typeof entry === 'string' ? {text: entry} : entry);
    const runs = authored.map(run => ({text: bindNoBreak(run.text), size: run.fontSize !== undefined ? run.fontSize / .75 : item.text.fontSize, measure: measurer(run)}));
    // Core's lines are slices of the authored text; binding no-break spaces keeps every offset.
    const whole = authored.map(run => run.text).join('');
    let cursor = 0, current = {runs, lines: []};
    paragraphs.push(current);
    for (const line of lines) {
      if (!whole.startsWith(line, cursor)) return false;
      current.lines.push({start: cursor, end: cursor + line.length});
      cursor += line.length;
      const hard = /^(?:\r\n|\r|\n)/.exec(whole.slice(cursor));
      if (hard) { cursor += hard[0].length; current = {runs, lines: []}; paragraphs.push(current); }
    }
    return cursor === whole.length;
  };
  if (list) {
    if (!values.every((value, index) => source(value, item.text.listEntries[index]?.text?.lines ?? []))) return undefined;
  } else if (!source(values[0], item.text.lines ?? [])) return undefined;
  const width = (runs, start, end) => {
    let total = 0, offset = 0;
    for (const run of runs) {
      const from = Math.max(start, offset), to = Math.min(end, offset + run.text.length);
      if (to > from) total += run.measure(run.text.slice(from - offset, to - offset), run.size);
      offset += run.text.length;
    }
    return total;
  };
  return {paragraphs, width};
}

/**
 * The widths that decide a native wrap of core's lines: `widest`, the widest line without the spaces that hang at its end, and `unbroken`,
 * the narrowest soft-wrapped line with the first unit of the next line (Infinity with no soft break): the next line's first word, to a
 * breakable space or through a hyphen, or its first character after a break inside a word. A box that wraps between the two keeps the
 * lines. Undefined when the lines cannot be verified.
 */
export function nativeWrapWidths(item, values, list, textMeasurement) {
  const text = nativeBodyLines(item, values, list, textMeasurement);
  if (!text) return undefined;
  let widest = 0, unbroken = Infinity;
  for (const {runs, lines} of text.paragraphs) {
    const whole = runs.map(run => run.text).join('');
    lines.forEach((line, index) => {
      let end = line.end;
      while (end > line.start && BREAKABLE.test(whole[end - 1])) end--;
      widest = Math.max(widest, text.width(runs, line.start, end));
      const next = lines[index + 1];
      if (!next) return;
      const afterWord = line.end > line.start && (BREAKABLE.test(whole[line.end - 1]) || HYPHEN.test(whole[line.end - 1]));
      let unit = next.start;
      if (afterWord) {
        while (unit < next.end && !BREAKABLE.test(whole[unit]) && !HYPHEN.test(whole[unit])) unit++;
        if (unit < next.end && HYPHEN.test(whole[unit])) unit++;
      }
      if (unit === next.start && next.end > next.start) unit += String.fromCodePoint(whole.codePointAt(next.start)).length;
      unbroken = Math.min(unbroken, text.width(runs, line.start, unit));
    });
  }
  return {widest, unbroken};
}

/**
 * The native body's horizontal box (`x`, `width`, px; a list's includes its marker indent): core's wrap width plus about one average
 * character of slack, narrowed or widened so the widest line and the narrowest soft break both keep WRAP_MARGIN of core's wrap width, and
 * never past `limits` (a card's inner edge, else the slide) on the side the alignment grows (both sides for centered text, which keeps its
 * center). Undefined when no width keeps every line.
 */
export function nativeWrapBox(item, values, list, limits, textMeasurement) {
  const indent = list ? item.text.listEntries[0].marker.indent : 0, wrapWidth = item.box.width - indent;
  const widths = wrapWidth > 0 ? nativeWrapWidths(item, values, list, textMeasurement) : undefined;
  if (!widths) return undefined;
  const margin = WRAP_MARGIN * wrapWidth;
  const average = textWidthMeasurer(resolveTextStyle(item.textStyle, textMeasurement), textMeasurement)('abcdefghijklmnopqrstuvwxyz', item.text.fontSize) / 26;
  const alignment = item.alignment ?? 'left';
  const left = Math.max(0, item.box.x - limits.left), right = Math.max(0, limits.right - (item.box.x + item.box.width));
  const room = alignment === 'center' ? 2 * Math.min(left, right) : alignment === 'right' ? left : right;
  const low = widths.widest + margin, high = Math.min(widths.unbroken - margin, wrapWidth + room);
  if (!(low <= high)) return undefined;
  const width = indent + Math.min(Math.max(wrapWidth + average, low), high);
  const grow = width - item.box.width;
  return {x: item.box.x - (alignment === 'center' ? grow / 2 : alignment === 'right' ? grow : 0), width};
}

// RR-88: the native auto-number (`a:buAutoNum`) that reproduces core's markers, or undefined when the entries are not one sequence.
function nativeNumbering(entries) {
  const first = entries[0]?.marker?.number;
  if (!first || !Number.isInteger(first.value) || first.value < 1) return undefined;
  const scheme = autoNumScheme(first.style, first.suffix);
  return entries.every((entry, index) => {
    const number = entry.marker?.number;
    return number && number.value === first.value + index && autoNumScheme(number.style, number.suffix) === scheme;
  }) ? {style: scheme, startAt: first.value} : undefined;
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
      // LH-11: PowerPoint wraps the body itself, so the spaces core's line breaker never breaks at are no-break spaces (import writes them back).
      const pieces = bindNoBreak(run.text).split(/\r\n|\r|\n/);
      pieces.forEach((text, index) => {
        if (index) { paragraph = []; paragraphs.push(paragraph); }
        paragraph.push({text, options: {...runOptions}});
      });
    }
  }
  const indent = list ? item.text.listEntries[0].marker.indent * .75 : undefined;
  const paragraphOptions = !list ? {bullet: false} : plan.numbering ? {bullet: {type: 'number', style: plan.numbering.style, startAt: plan.numbering.startAt, indent}, hanging: indent / 4, indentLevel: 0}
    : {bullet: {characterCode: '2022', indent}, hanging: indent / 4, indentLevel: 0};
  // LH-98: core's measured line pitch as exact spacing, as native titles write it, and core's gap between list entries as space before
  // each later entry, so the native body ends where core's body box ends. A multiple (122%) applies to the face's own line height
  // (its ascent plus descent), which draws lines about 20% taller than core measured. A list entry is one paragraph (an entry with a
  // hard break falls back to measured shapes), so paragraph `index` is entry `index`.
  const entries = list ? item.text.listEntries : undefined;
  const pitch = index => (entries?.[index]?.text ?? item.text).lineHeight * .75;
  const gapBefore = index => {
    const entry = entries?.[index], previous = entries?.[index - 1];
    return entry && previous ? Math.max(0, entry.textBox.y - (previous.textBox.y + previous.textBox.height)) * .75 : 0;
  };
  const runs = paragraphs.flatMap((paragraph, index) => {
    if (!paragraph.length) paragraph = [{text: '', options: {}}];
    const spacing = {lineSpacing: pitch(index), ...(gapBefore(index) > 0 ? {paraSpaceBefore: gapBefore(index)} : {})};
    return paragraph.map((run, position) => ({...run, options: {...run.options, ...paragraphOptions, ...spacing,
      breakLine: position === paragraph.length - 1 && index < paragraphs.length - 1}}));
  });
  const objectName = `OPF native body ${item.path}`;
  // RR-105: the box wraps where core wrapped (nativeWrapBox), at the item's columns (a region can be wider than core's measure).
  const {x, width} = plan.wrap;
  slide.addText(runs, {...helpers.textBoxOptions({x: x / 96, y: box.y / 96, w: width / 96, h: box.height / 96}, context, item.text.fontSize * .75),
    ...baseFont, ...paragraphOptions, objectName, align: item.alignment ?? 'left', valign: {top: 'top', middle: 'mid', bottom: 'bottom'}[anchor],
    fit: 'none', wrap: true, lineSpacing: pitch(0), lineSpacingMultiple: undefined, bold: false, italic: false});
  // Defaults for blank/appended paragraphs must name the selected family too.
  const defaults = `<a:defRPr sz="${Math.round(item.text.fontSize * 75)}" b="${baseFont.bold ? 1 : 0}" i="${baseFont.italic ? 1 : 0}"><a:solidFill>${helpers.solidColorXml(context.textColor)}</a:solidFill><a:latin typeface="${escapeXml(baseFont.fontFace)}"/></a:defRPr>`;
  return {objectName, defaults};
}

/** RR-88: a native title is written with an explicit no-autofit body, so the Title placeholder's own autofit cannot shrink or move it. */
export function nativeTitleAutofit(xml, names) {
  if (!names?.size) return xml;
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => names.has(shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1])
    ? shape.replace(/(<a:bodyPr\b[^>]*>)[\s\S]*?<\/a:bodyPr>/, '$1<a:noAutofit/></a:bodyPr>') : shape);
}

const NO_SPACE_BEFORE = '<a:spcBef><a:spcPts val="0"/></a:spcBef>', NO_SPACE_AFTER = '<a:spcAft><a:spcPts val="0"/></a:spcAft>';
// The spacing a paragraph does not write (LH-98 writes space before the later list entries), as 0, in schema order: lnSpc, spcBef, spcAft.
const zeroParagraphSpace = pPr => {
  if (!pPr.includes('<a:spcBef>')) pPr = pPr.includes('</a:lnSpc>') ? pPr.replace('</a:lnSpc>', `</a:lnSpc>${NO_SPACE_BEFORE}`) : pPr.replace(/^(<a:pPr\b[^>]*>)/, `$1${NO_SPACE_BEFORE}`);
  return pPr.includes('<a:spcAft>') ? pPr : pPr.replace('</a:spcBef>', `</a:spcBef>${NO_SPACE_AFTER}`);
};

/** Only prototype objects receive explicit no-autofit and paragraph typing defaults. */
export function nativeBodyDefaults(xml, records) {
  if (!records?.size) return xml;
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
    const name = shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1];
    const defaults = records.get(name);
    if (!defaults) return shape;
    shape = shape.replace(/(<a:bodyPr\b[^>]*>)[\s\S]*?<\/a:bodyPr>/, '$1<a:noAutofit/></a:bodyPr>');
    // LH-91: no space before or after a paragraph, as core measured the lines. A body bound to a placeholder would otherwise take the
    // master's body style (spcBef 20%), and each paragraph would sit lower than in a text box beside it.
    shape = shape.replace(/<a:pPr\b([^>]*?)\/>|<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/g, (pPr, empty) => empty !== undefined ? `<a:pPr${empty}>${NO_SPACE_BEFORE}${NO_SPACE_AFTER}</a:pPr>` : zeroParagraphSpace(pPr));
    const pPr = shape.match(/<a:pPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:pPr>)/)?.[0] ?? '<a:pPr/>';
    const paragraphDefault = pPr.replace(/<a:pPr\b/, '<a:defPPr').replace(/<\/a:pPr>/, '</a:defPPr>').replace(/<a:defRPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:defRPr>)/g, '');
    const withDefaults = paragraphDefault.endsWith('/>') ? paragraphDefault.slice(0, -2) + `>${defaults}</a:defPPr>` : paragraphDefault.replace('</a:defPPr>', `${defaults}</a:defPPr>`);
    shape = shape.replace(/<a:lstStyle\s*\/>/, `<a:lstStyle>${withDefaults}</a:lstStyle>`);
    return shape.replace(/<a:endParaRPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:endParaRPr>)/g, defaults.replaceAll('a:defRPr', 'a:endParaRPr'));
  });
}
