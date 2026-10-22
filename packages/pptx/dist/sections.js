// Native PowerPoint sections (spec-gap closure P1).
//
// A slide's `section` is PowerPoint's own section label. It is written as the
// PowerPoint 2010 section list, `p14:sectionLst` inside `p:presentation/
// p:extLst`, the structure PowerPoint shows in its sections pane and keeps
// through saves. Each maximal run of consecutive slides with the same `section`
// is one section; runs of slides without a section become `Default Section`,
// PowerPoint's own name for the section it creates when a deck first gets one,
// so every slide is covered (the list is only valid when it is complete).
// Section ids are deterministic GUIDs derived from the run index and name.
//
// Import reads the list back: a slide in a section named exactly `Default
// Section` has no `section`; any other name is the slide's `section`. The
// native list wins over the stored OPF_SLIDE_V1 value and over the section
// text a footer shows, since PowerPoint edits the list, not the hidden tags.

import {hashText} from './document-provenance.js';

export const DEFAULT_SECTION = 'Default Section';
const SECTION_EXT_URI = '{521415D9-36F7-43E2-AB2F-B90AF26B5E84}';
const P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main';

const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const escape = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Characters XML 1.0 cannot carry; the same guard the text runs use (invalid-text).
export const INVALID_XML_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF￾￿]/u;
// An attribute value is normalized by every XML reader (tab, LF and CR become
// spaces), so a re-saved list would differ from the authored label. Write the
// normalized form, and compare labels the same way (`sameSectionName`).
export const normalizeSectionName = value => String(value).replace(/[\t\n\r]/g, ' ');
export const sameSectionName = (a, b) => normalizeSectionName(a) === normalizeSectionName(b);

// A blank label names no section.
const named = value => typeof value === 'string' && value.trim() !== '';

/** Maximal runs of consecutive slides with the same section: [{name, slides: [index]}]. */
export function sectionRuns(sections) {
  const runs = [];
  for (const [index, value] of sections.entries()) {
    const name = named(value) ? value : DEFAULT_SECTION;
    const last = runs.at(-1);
    if (last && last.name === name) last.slides.push(index);
    else runs.push({name, slides: [index]});
  }
  return runs;
}

// Change detection hashes (cyrb53) formatted as a version-4-shaped GUID: stable
// for the same run index and name, which keeps the package deterministic.
export function sectionId(index, name) {
  const first = hashText(`${index}\u0000${name}`), second = hashText(`${name}\u0000${index}\u0000section`);
  const hex = (first + second + hashText(first + second)).toUpperCase();
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(12, 15)}-8${hex.slice(15, 18)}-${hex.slice(18, 30)}}`;
}

/**
 * Insert the section list into `presentationXml` for the per-slide `sections`
 * (string or undefined, in slide order). Returns the XML unchanged when no
 * slide has a section. The `p:sldId` ids are read from the presentation part,
 * which must list exactly one id per slide.
 */
export function writeSectionList(presentationXml, sections) {
  if (!sections.some(named)) return presentationXml;
  const ids = [...presentationXml.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map(match => match[1]);
  if (ids.length !== sections.length) throw Error('Generated slide id count differs from the document.');
  if (/<p14:sectionLst\b/.test(presentationXml)) throw Error('Generated presentation already has a section list.');
  for (const [index, name] of sections.entries()) {
    const invalid = named(name) ? INVALID_XML_CHARACTER.exec(name) : null;
    if (invalid) throw Error(`slides.${index}.section contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} at UTF-16 offset ${invalid.index}, which PresentationML XML cannot represent.`);
  }
  const list = sectionRuns(sections.map(name => named(name) ? normalizeSectionName(name) : name)).map((run, index) =>
    `<p14:section name="${escape(run.name)}" id="${sectionId(index, run.name)}"><p14:sldIdLst>${run.slides.map(slide => `<p14:sldId id="${ids[slide]}"/>`).join('')}</p14:sldIdLst></p14:section>`).join('');
  const ext = `<p:ext uri="${SECTION_EXT_URI}"><p14:sectionLst xmlns:p14="${P14}">${list}</p14:sectionLst></p:ext>`;
  // CT_Presentation: extLst is the last child. Join an existing list, else add one.
  if (presentationXml.includes('</p:extLst>')) return presentationXml.replace('</p:extLst>', `${ext}</p:extLst>`);
  const close = presentationXml.lastIndexOf('</p:presentation>');
  if (close < 0) throw Error('Generated presentation part has no closing element.');
  return `${presentationXml.slice(0, close)}<p:extLst>${ext}</p:extLst>${presentationXml.slice(close)}`;
}

/**
 * The native section list of a parsed `p:presentation` root: a Map from
 * `p:sldId` id to section name, or null when the package has no section list.
 * Names are untrusted strings; a malformed list counts as none.
 */
export function readSectionList(presentationRoot) {
  const ext = array(presentationRoot?.['p:extLst']?.['p:ext']).find(item => object(item) && item['p14:sectionLst'] !== undefined);
  if (!ext) return null;
  const list = ext['p14:sectionLst'];
  if (!object(list)) return null;
  const map = new Map();
  for (const section of array(list['p14:section'])) {
    if (!object(section) || typeof section.name !== 'string') continue;
    for (const slide of array(section['p14:sldIdLst']?.['p14:sldId'])) {
      const id = object(slide) ? slide.id : undefined;
      if (typeof id === 'string' && /^\d+$/.test(id) && !map.has(id)) map.set(id, section.name);
    }
  }
  return map;
}

/** Per-slide section names from the native list, aligned with `slideIds` (the `p:sldId` ids in slide order); null without a list. */
export function nativeSections(presentationRoot, slideIds) {
  const map = readSectionList(presentationRoot);
  if (!map) return null;
  return slideIds.map(id => {
    const name = map.get(String(id));
    return name === undefined || name === DEFAULT_SECTION ? undefined : name;
  });
}
