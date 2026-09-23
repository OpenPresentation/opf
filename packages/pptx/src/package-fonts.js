import {unzipSync, zipSync} from 'fflate';
import {inventoryPptxTypefaces, packageFontsUsed, headingPairs, titlesOfParts} from './typeface-inventory.js';

// Package-level font post-processing (FF-08, font-fidelity-everywhere). The
// vendored PptxGenJS bytes stay untouched; these passes rewrite its output so
// the package names only the fonts the document chose:
// - chart text properties (data labels, axes, legend, titles) use the chart's
//   body font in latin/ea/cs instead of the hard-coded Arial;
// - each chart's embedded workbook uses the same fonts in its styles and
//   theme, with no Office script supplements;
// - run pitchFamily follows the font's catalog type (monospace is fixed pitch);
// - docProps/app.xml "Fonts Used" lists the fonts the package actually uses.

const decoder = new TextDecoder(), encoder = new TextEncoder();
const text = bytes => decoder.decode(bytes);
const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));

// OOXML pitchFamily: low bits are the pitch (1 fixed, 2 variable), high bits
// the family (0x10 roman, 0x20 swiss, 0x30 modern). These are the values
// PowerPoint writes for Consolas/Courier New, Georgia/Times New Roman and
// Calibri/Arial respectively.
export const PITCH_FAMILY = Object.freeze({monospace: 49, serif: 18, 'sans-serif': 34});

// family -> pitchFamily. A scheme's type describes its major/minor families,
// not inline heading/body overrides. Each slide's resolved scheme wins, then
// catalog records where every record agrees, then the code role (monospace).
// Families with no known type keep the vendor value.
export function fontPitchFamilies(slideFonts, records) {
  const pitch = new Map();
  const typed = record => [record?.major, record?.minor].filter(family => typeof family === 'string' && family).map(family => [family, PITCH_FAMILY[record.type]]);
  for (const fonts of slideFonts) for (const [family, value] of typed(fonts.scheme)) if (value !== undefined && !pitch.has(family)) pitch.set(family, value);
  const catalog = new Map();
  for (const record of records) for (const [family, value] of typed(record)) catalog.set(family, catalog.has(family) && catalog.get(family) !== value ? undefined : value);
  for (const [family, value] of catalog) if (value !== undefined && !pitch.has(family)) pitch.set(family, value);
  for (const fonts of slideFonts) if (fonts.code && !pitch.has(fonts.code)) pitch.set(fonts.code, PITCH_FAMILY.monospace);
  return pitch;
}

export function writePitchFamilies(xml, pitch) {
  if (!pitch.size || !xml.includes('pitchFamily=')) return xml;
  return xml.replace(/<a:(latin|ea|cs|sym|buFont)\b([^<>]*?)\/>/g, (node, element, attributes) => {
    const face = /\btypeface="([^"]*)"/.exec(attributes)?.[1];
    if (face === undefined || !/\bpitchFamily="/.test(attributes)) return node;
    const value = pitch.get(unescapeFace(face));
    if (value === undefined) return node;
    return `<a:${element}${attributes.replace(/\bpitchFamily="[^"]*"/, `pitchFamily="${value}"`)}/>`;
  });
}

// Chart parts: every text property element names the chart font in all three
// script slots, in schema order (after fills/underline, before sym/hlink/rtl).
export function writeChartFonts(xml, family) {
  const face = escapeXml(family);
  const slots = `<a:latin typeface="${face}"/><a:ea typeface="${face}"/><a:cs typeface="${face}"/>`;
  return xml.replace(/<a:(defRPr|rPr)\b([^<>]*?)(?:\/>|>([\s\S]*?)<\/a:\1>)/g, (node, element, attributes, body) => {
    if (attributes.endsWith('/')) attributes = attributes.slice(0, -1);
    const content = (body ?? '').replace(/<a:(latin|ea|cs)\b[^<>]*?(?:\/>|>\s*<\/a:\1>)/g, '');
    const tail = /<a:(?:sym|hlinkClick|hlinkMouseOver|rtl|extLst)\b/.exec(content);
    const at = tail ? tail.index : content.length;
    return `<a:${element}${attributes}>${content.slice(0, at)}${slots}${content.slice(at)}</a:${element}>`;
  });
}

// Embedded chart workbook: every SpreadsheetML font uses the chart body font
// (each <font> in styles.xml, whether under <fonts>, <dxfs> or elsewhere, and
// any rich-text <rFont> in shared strings or sheets); the workbook theme uses
// the chart heading/body fonts with empty ea/cs slots and no Office script
// supplements. Parts without fonts are kept byte for byte.
export function writeWorkbookFonts(bytes, fonts) {
  const entries = unzipSync(bytes);
  const styles = entries['xl/styles.xml'], theme = entries['xl/theme/theme1.xml'];
  const setVal = node => node.replace(/\bval="[^"]*"/, `val="${escapeXml(fonts.body)}"`);
  if (styles) {
    entries['xl/styles.xml'] = encoder.encode(text(styles).replace(/<font\b[^>]*>[\s\S]*?<\/font>/g, font =>
      font.replace(/<name\b[^>]*?\bval="[^"]*"/g, setVal)));
  }
  for (const path of Object.keys(entries)) {
    if (!/^xl\/(?:sharedStrings|worksheets\/[^/]+)\.xml$/.test(path)) continue;
    const xml = text(entries[path]);
    if (xml.includes('<rFont')) entries[path] = encoder.encode(xml.replace(/<rFont\b[^>]*?\bval="[^"]*"/g, setVal));
  }
  if (theme) {
    const collection = (name, family) => `<a:${name}><a:latin typeface="${escapeXml(family)}"/><a:ea typeface=""/><a:cs typeface=""/></a:${name}>`;
    entries['xl/theme/theme1.xml'] = encoder.encode(text(theme)
      .replace(/<a:majorFont>[\s\S]*?<\/a:majorFont>/, collection('majorFont', fonts.heading))
      .replace(/<a:minorFont>[\s\S]*?<\/a:minorFont>/, collection('minorFont', fonts.body)));
  }
  // The caller's package normalization rezips nested packages deterministically.
  return zipSync(entries, {level: 0});
}

// Rewrites chart parts and their workbooks for charts the exporter created,
// found through each slide's chart graphic frames (per-slide fonts apply).
export function applyChartFonts(entries, chartFonts, parseRelationships) {
  if (!chartFonts.size) return;
  for (const part of Object.keys(entries)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(part)) continue;
    const relationships = parseRelationships(entries, part);
    for (const [frame] of text(entries[part]).matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)) {
      const fonts = chartFonts.get(frame.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1]);
      const chartPart = relationships.get(frame.match(/<c:chart\b[^>]*\br:id="([^"]+)"/)?.[1])?.path;
      if (!fonts || !chartPart || !entries[chartPart]) continue;
      entries[chartPart] = encoder.encode(writeChartFonts(text(entries[chartPart]), fonts.body));
      for (const relationship of parseRelationships(entries, chartPart).values()) {
        if (relationship.type.endsWith('/package') && /\.xlsx$/i.test(relationship.path) && entries[relationship.path]) {
          entries[relationship.path] = writeWorkbookFonts(entries[relationship.path], fonts);
        }
      }
    }
  }
}

export function applyPitchFamilies(entries, pitch) {
  for (const part of Object.keys(entries)) {
    if (/^ppt\/.*\.xml$/.test(part)) {
      const xml = text(entries[part]), next = writePitchFamilies(xml, pitch);
      if (next !== xml) entries[part] = encoder.encode(next);
    }
  }
}

// docProps/app.xml: regenerate the "Fonts Used" group of HeadingPairs and
// TitlesOfParts from the fonts the finished package uses, and name the theme
// the way the theme part does. Other groups (slide titles) are kept.
export function writeFontsUsed(appXml, fonts, themeName) {
  const pairs = headingPairs(appXml), titles = titlesOfParts(appXml);
  if (!pairs || !titles) return appXml;
  const groups = [];
  let offset = 0;
  for (const [name, count] of pairs) {
    groups.push([name, titles.slice(offset, offset + count)]);
    offset += count;
  }
  const fontsGroup = groups.find(([name]) => name === 'Fonts Used');
  if (fontsGroup) fontsGroup[1] = fonts;
  else groups.unshift(['Fonts Used', fonts]);
  const themeGroup = groups.find(([name]) => name === 'Theme');
  if (themeGroup && themeName && themeGroup[1].length === 1) themeGroup[1] = [themeName];
  const kept = groups.filter(([, items]) => items.length);
  const variants = kept.map(([name, items]) => `<vt:variant><vt:lpstr>${escapeXml(name)}</vt:lpstr></vt:variant><vt:variant><vt:i4>${items.length}</vt:i4></vt:variant>`).join('');
  const items = kept.flatMap(([, list]) => list).map(item => `<vt:lpstr>${escapeXml(item)}</vt:lpstr>`).join('');
  return appXml
    .replace(/<HeadingPairs>[\s\S]*?<\/HeadingPairs>/, `<HeadingPairs><vt:vector size="${kept.length * 2}" baseType="variant">${variants}</vt:vector></HeadingPairs>`)
    .replace(/<TitlesOfParts>[\s\S]*?<\/TitlesOfParts>/, `<TitlesOfParts><vt:vector size="${kept.reduce((sum, [, list]) => sum + list.length, 0)}" baseType="lpstr">${items}</vt:vector></TitlesOfParts>`);
}

// Runs on the normalized output map (path -> [bytes, options]) after every
// other part rewrite, so the list reflects the final theme and slides.
export function finalizeFontsUsed(output) {
  const app = output['docProps/app.xml'];
  if (!app) return;
  const parts = {};
  for (const [path, [bytes]] of Object.entries(output)) if (/^ppt\/.*\.xml$/.test(path)) parts[path] = bytes;
  const fonts = packageFontsUsed(inventoryPptxTypefaces(parts, {nested: false}));
  const themeName = /<a:theme\b[^>]*\bname="([^"]*)"/.exec(parts['ppt/theme/theme1.xml'] ? text(parts['ppt/theme/theme1.xml']) : '')?.[1];
  output['docProps/app.xml'] = [encoder.encode(writeFontsUsed(text(app[0]), fonts, themeName === undefined ? undefined : unescapeFace(themeName))), app[1]];
}

function unescapeFace(value) {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ({amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"}[name]));
}
