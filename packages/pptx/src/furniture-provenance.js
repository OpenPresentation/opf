import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag, encodeTextTag} from './code-provenance.js';
import {sourceLineParagraphs} from './text-provenance.js';
import {DEFAULT_DATE_FORMAT, NATIVE_DATE_FIELDS, formatSlideNumber, parseDate} from './furniture-fields.js';
import {schemas} from '@openpresentation/opf';
import {LOGO_TAG} from './logo-provenance.js';
import {NATIVE_PLACEHOLDERS, footerValue, isNativePlaceholderType, readNativePlaceholders} from './native-furniture.js';

const TAG = 'OPF_FURNITURE_V1';
// A slide has one tag list; it also carries the document's OPF_SLIDE_V1 record.
const SLIDE_TAG = 'OPF_SLIDE_V1';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal: true});
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const kinds = ['header', 'footer'], zones = ['left', 'center', 'right'];
const fields = ['text', 'image', 'organization', 'speaker', 'socials', 'section', 'slideNumber', 'date'];
const settings = ['slideNumberFormat', 'dateFormat'];
const dateFormatForField = Object.fromEntries(Object.entries(NATIVE_DATE_FIELDS).map(([format, type]) => [type, format]));
// Platform keys follow the Socials schema's propertyNames pattern exactly, so
// every key a valid document can carry re-imports (and nothing else does).
const platformId = new RegExp(schemas.presentation.$defs.Socials.propertyNames.pattern, 'u'), schemes = ['', 'https://'];
// Socials lines show a profile URL without the https:// scheme; the manifest
// keeps only each line's platform id and the stripped scheme, never its words.
const socialLines = part => part.links.map(link => ({platform: link.platform,
  scheme: link.href && !/^[a-z][a-z0-9+.-]*:/i.test(link.text) ? 'https://' : ''}));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const key = part => `${part.kind}.${part.zone}.${part.field}`;
// Key order is not meaning: a value merged from native placeholders equals the same value read from a manifest.
const canonical = value => JSON.stringify(value, (key, item) => object(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const same = (a, b) => canonical(a) === canonical(b);
const check = (condition, message) => { if (!condition) throw Error(message); };

// Change detection, not authentication: editable tags store no cached date words.
function dateLineFingerprint(text) {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let index = 0; index < text.length; index++) {
    a = Math.imul(a ^ text.charCodeAt(index), 2654435761);
    b = Math.imul(b ^ text.charCodeAt(index), 1597334677);
  }
  return `${text.length}:${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

// Only the exporter may mark its own supported, whole-date field flattened by
// an accepted soft wrap. Literal dates and unsupported patterns stay ordinary.
export function staticDateFallback(part, field) {
  const format = field.format ?? DEFAULT_DATE_FORMAT;
  if (part.field !== 'date' || field.type !== 'date' || !NATIVE_DATE_FIELDS[format] ||
      field.start !== 0 || field.end !== part.text.length || part.fit.lines.length < 2) return undefined;
  const records = part.fit.sourceLines.map((line, index) => ({index, data: {
    boundary: line.boundary, separator: part.text.slice(line.end, line.nextStart),
  }}));
  if (records.some((record, index) => record.data.boundary !== (index === records.length - 1 ? 'end' : 'soft'))) return undefined;
  try {
    if (sourceLineParagraphs(records, part.fit.lines.map(text => [{text}]))[0].text !== part.text) return undefined;
  } catch { return undefined; }
  return {v: 1, reason: 'wrapped-native-date', format, fingerprints: part.fit.lines.map(dateLineFingerprint)};
}

function unchangedStaticDate(marker, format, ordered, paragraphs) {
  check(object(marker) && Object.keys(marker).sort().join(',') === 'fingerprints,format,reason,v' &&
    marker.v === 1 && marker.reason === 'wrapped-native-date' && typeof marker.format === 'string' &&
    Object.hasOwn(NATIVE_DATE_FIELDS, marker.format) && marker.format === (format.dateFormat ?? DEFAULT_DATE_FORMAT) &&
    ordered.length > 1 && Array.isArray(marker.fingerprints) && marker.fingerprints.length === ordered.length,
  'Invalid static date fallback evidence.');
  check(ordered.every((record, index) => {
    const current = paragraphs[record.index] ?? [];
    return record.data.boundary === (index === ordered.length - 1 ? 'end' : 'soft') && record.data.separator === '' &&
      typeof marker.fingerprints[index] === 'string' && /^\d+:[0-9a-f]{16}$/.test(marker.fingerprints[index]) &&
      current.length === 1 && !current[0].bullet && dateLineFingerprint(current[0].text) === marker.fingerprints[index];
  }), 'Current static date text or boundaries differ from the exported lines.');
}

// This manifest contains topology, identities, inactive flags and format
// settings only. Current native shapes supply all words, image bytes and alt
// text, even after edits; a recorded format is kept only while the current text
// still matches it exactly.
export function furnitureManifest(presentation, slide, layout, slideIndex, staticDates = new Map(), natives = new Map()) {
  const definitions = {}, formats = {};
  for (const kind of kinds) {
    const local = slide.design?.[kind] !== undefined;
    const source = local ? slide.design[kind] : presentation.design?.[kind];
    if (source === undefined) continue;
    const value = source === false ? false : {};
    if (value !== false) for (const zone of zones) if (source[zone] !== undefined) {
      value[zone] = {};
      for (const field of fields) if (source[zone][field] !== undefined) {
        const current = source[zone][field];
        value[zone][field] = field === 'image' ? 'native' : typeof current === 'string' ? 'literal' : current;
      }
      const format = Object.fromEntries(settings.filter(setting => typeof source[zone][setting] === 'string').map(setting => [setting, source[zone][setting]]));
      if (Object.keys(format).length) formats[`${kind}.${zone}`] = format;
    }
    definitions[kind] = {scope: local ? 'local' : 'global', value};
  }
  if (!Object.keys(definitions).length) return null;
  const organizations = array(presentation.organization);
  const organization = organizations.find(item => item.role === 'primary') ?? organizations[0];
  const speaker = array(presentation.speaker)[0];
  // Generated deck logos (logo: true) are listed beside the topology, never inside it: the part list and the field
  // definitions are validated strictly by every released importer (0.11.6 and earlier reject an unknown field there),
  // so they keep describing only what those importers know. `drawn` is false when no logo resolved at export.
  const logos = [];
  for (const kind of kinds) {
    const source = (slide.design?.[kind] !== undefined ? slide.design : presentation.design)?.[kind];
    for (const zone of zones) if (definitions[kind]?.value?.[zone] && source?.[zone]?.logo === true) {
      logos.push({kind, zone, drawn: layout.parts.some(part => part.field === 'logo' && part.kind === kind && part.zone === zone)});
    }
  }
  return {v: 1, role: 'slide', group: String(slideIndex), definitions, ...(Object.keys(formats).length ? {formats} : {}),
    ...(layout.parts.some(part => part.field === 'organization' || part.field === 'socials') ? {organizationId: organization?.id} : {}),
    ...(layout.parts.some(part => part.field === 'speaker') ? {speakerId: speaker?.id} : {}),
    parts: layout.parts.flatMap((part, index) => part.field === 'logo' ? [] : [{kind: part.kind, zone: part.zone, field: part.field,
      type: part.type, count: part.type === 'image' ? 1 : part.fit.lines.length,
      ...(part.field === 'socials' ? {socials: socialLines(part)} : {}),
      // The speaker part is one line, "Name, Title" or "Name": the name's length lets import split it again (lengths, never words).
      ...(part.field === 'speaker' ? {nameLength: speaker.name.length} : {}),
      ...(staticDates.has(index) ? {staticDate: staticDates.get(index)} : {}),
      // RR-11: this part is a native PowerPoint placeholder (dt, ftr or sldNum); deleting it in PowerPoint's dialog is then intent.
      ...(natives.has(index) ? {ph: natives.get(index)} : {})}]),
    ...(logos.length ? {logos} : {})};
}

// The manifest index of a layout part: logo parts are not in the manifest, so later parts shift down.
export const manifestPartIndex = (parts, index) => parts.slice(0, index).filter(part => part.field !== 'logo').length;

export function attachFurnitureTags(entries, records, manifests, logoRecords = new Map()) {
  attachTextTags(entries, records, TAG, 'opfFurniture', 'furniture', {pictures: true});
  // A generated logo picture carries the logo tag (never the furniture tag): see logo-provenance.js.
  attachTextTags(entries, logoRecords, LOGO_TAG, 'opfFurnitureLogo', 'furniture logo', {pictures: true});
  const types = [];
  for (const [path, manifest] of manifests) {
    const part = `ppt/tags/opfFurnitureSlide${manifest.group}.xml`;
    const relPath = path.replace('/slides/', '/slides/_rels/') + '.rels';
    let xml = dec.decode(entries[path]), rels = dec.decode(entries[relPath]);
    // Common-slide customer data follows spTree, before controls/extLst.
    // No invisible/fake shape is necessary for false or empty definitions.
    const ids = new Set([...rels.matchAll(/\bId="([^"]+)"/g)].map(match => match[1]));
    let id = 'rIdOpfFurnitureSlide';
    while (ids.has(id)) id += '_';
    check(!entries[part] && xml.includes('</p:spTree>'), 'Missing slide tree or colliding furniture tag part.');
    xml = xml.replace('</p:spTree>', `</p:spTree><p:custDataLst><p:tags r:id="${id}"/></p:custDataLst>`);
    rels = rels.replace('</Relationships>', `<Relationship Id="${id}" Type="${REL}" Target="../tags/opfFurnitureSlide${manifest.group}.xml"/></Relationships>`);
    entries[part] = enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:p="${NS}"><p:tag name="${TAG}" val="${encodeTextTag(manifest)}"/></p:tagLst>`);
    entries[path] = enc.encode(xml);
    entries[relPath] = enc.encode(rels);
    types.push(`<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/>`);
  }
  if (types.length) entries['[Content_Types].xml'] = enc.encode(dec.decode(entries['[Content_Types].xml']).replace('</Types>', types.join('') + '</Types>'));
}

function readTags(container, relationships, entries) {
  const tags = [];
  let unreadable = false;
  for (const link of array(container?.['p:tags'])) {
    const rel = relationships.get(link['r:id']);
    try {
      check(rel?.type === REL && rel.targetMode !== 'External' && entries[rel.path], 'Missing tag relationship.');
      tags.push(...array(parser.parse(dec.decode(entries[rel.path]))['p:tagLst']?.['p:tag']));
    } catch { unreadable = true; }
  }
  return {tags: tags.filter(tag => tag.name?.toUpperCase() === TAG),
    ambiguous: unreadable || tags.filter(tag => /^OPF_/i.test(tag.name) && tag.name.toUpperCase() !== SLIDE_TAG).length !== 1};
}

function validateManifest(manifest) {
  check(manifest?.v === 1 && manifest.role === 'slide' && /^\d{1,10}$/.test(manifest.group), 'Invalid slide identity.');
  check(object(manifest.definitions) && Object.keys(manifest.definitions).length > 0 && Object.keys(manifest.definitions).every(kind => kinds.includes(kind)), 'Invalid furniture definitions.');
  check(Array.isArray(manifest.parts) && manifest.parts.length <= 36, 'Invalid furniture parts.');
  const expected = new Map();
  for (const [kind, definition] of Object.entries(manifest.definitions)) {
    check(object(definition) && ['global', 'local'].includes(definition.scope), 'Invalid furniture scope.');
    const value = definition.value;
    check(value === false || object(value), 'Invalid furniture definition.');
    if (value === false) continue;
    check(Object.keys(value).every(zone => zones.includes(zone)), 'Invalid furniture zone.');
    for (const [zone, content] of Object.entries(value)) {
      check(object(content) && Object.keys(content).every(field => fields.includes(field)), 'Invalid furniture fields.');
      for (const [field, flag] of Object.entries(content)) {
        check(field === 'image' ? flag === 'native' : field === 'text' ? flag === 'literal' :
          field === 'date' ? typeof flag === 'boolean' || flag === 'literal' : typeof flag === 'boolean', 'Invalid furniture field intent.');
        if (flag !== false) expected.set(`${kind}.${zone}.${field}`, field === 'image' ? 'image' : 'text');
      }
    }
  }
  if (manifest.logos !== undefined) {
    check(Array.isArray(manifest.logos) && manifest.logos.length <= 6, 'Invalid furniture logos.');
    const seen = new Set();
    for (const logo of manifest.logos) {
      const slot = `${logo?.kind}.${logo?.zone}`;
      check(object(logo) && kinds.includes(logo.kind) && zones.includes(logo.zone) && typeof logo.drawn === 'boolean' && Object.keys(logo).length === 3 &&
        object(manifest.definitions[logo.kind]?.value?.[logo.zone]) && !seen.has(slot), 'Invalid furniture logo.');
      seen.add(slot);
    }
  }
  if (manifest.formats !== undefined) {
    check(object(manifest.formats), 'Invalid furniture formats.');
    for (const [slot, format] of Object.entries(manifest.formats)) {
      const [kind, zone, extra] = slot.split('.');
      check(extra === undefined && object(manifest.definitions[kind]?.value?.[zone]) && object(format) && Object.keys(format).length > 0 &&
        Object.entries(format).every(([setting, value]) => settings.includes(setting) && typeof value === 'string'), 'Invalid furniture format.');
    }
  }
  check(manifest.parts.length === expected.size, 'Incomplete furniture topology.');
  for (const part of manifest.parts) {
    check(object(part) && expected.get(key(part)) === part.type, 'Ambiguous furniture part.');
    check(Number.isSafeInteger(part.count) && part.count >= 1 && part.count <= 10000 && (part.type !== 'image' || part.count === 1), 'Invalid furniture line count.');
    // RR-11: a footer part that is a native PowerPoint placeholder (dt, ftr, sldNum), unique per slide.
    if (part.ph !== undefined) check(isNativePlaceholderType(part.ph) && part.kind === 'footer' && part.type === 'text' && part.count === 1 &&
      NATIVE_PLACEHOLDERS[part.ph].field === part.field && manifest.parts.filter(other => other.ph === part.ph).length === 1, 'Invalid native placeholder part.');
    if (part.field === 'socials') check(Array.isArray(part.socials) && part.socials.length >= 1 && part.socials.length <= 100
      && part.socials.every(line => object(line) && platformId.test(line.platform) && schemes.includes(line.scheme))
      && new Set(part.socials.map(line => line.platform)).size === part.socials.length, 'Invalid social profile lines.');
    else check(part.socials === undefined, 'Unexpected social profile lines.');
    if (part.field === 'speaker') check(Number.isSafeInteger(part.nameLength) && part.nameLength >= 1 && part.nameLength <= 100000, 'Invalid speaker name length.');
    else check(part.nameLength === undefined, 'Unexpected speaker name length.');
    expected.delete(key(part));
  }
  if (manifest.parts.some(part => part.field === 'speaker')) check(typeof manifest.speakerId === 'string' && /^[a-zA-Z0-9_-]+$/.test(manifest.speakerId), 'Invalid speaker identity.');
  else check(manifest.speakerId === undefined, 'Unexpected speaker identity.');
  if (manifest.parts.some(part => part.field === 'organization' || part.field === 'socials')) check(typeof manifest.organizationId === 'string' && /^[a-zA-Z0-9_-]+$/.test(manifest.organizationId), 'Invalid organization identity.');
}

// The logo tags of a picture: any other OPF tag next to one is not an identity conflict for the furniture reader.
function readLogoTags(container, relationships, entries) {
  const found = [];
  for (const link of array(container?.['p:tags'])) {
    const rel = relationships.get(link['r:id']);
    if (rel?.type !== REL || rel.targetMode === 'External' || !entries[rel.path]) continue;
    found.push(...array(parser.parse(dec.decode(entries[rel.path]))['p:tagLst']?.['p:tag']).filter(tag => tag.name?.toUpperCase() === LOGO_TAG));
  }
  return found;
}

function readSlide(context, entries, slideIndex, slideCount, report, taggedText) {
  const {root, shapes, paragraphs, pictures, relationships, readPicture} = context;
  const candidates = {};
  const records = [];
  let invalidRecord = false;
  for (const [type, nodes, properties] of [['text', shapes, 'p:nvSpPr'], ['image', pictures, 'p:nvPicPr']]) {
    for (const [index, node] of nodes.entries()) {
      const result = readTags(node[properties]?.['p:nvPr']?.['p:custDataLst'], relationships, entries);
      if (type === 'text' && result.tags.length) taggedText.add(index);
      for (const tag of result.tags) try {
        check(!result.ambiguous, 'Multiple identities on a furniture shape.');
        records.push({type, index, data: decodeTextTag(tag.val)});
      } catch { invalidRecord = true; }
    }
  }
  // Generated logo pictures: identity only, the bytes come from design.logo.
  const logoPictures = [];
  for (const [index, node] of pictures.entries()) try {
    for (const tag of readLogoTags(node['p:nvPicPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries)) {
      const data = decodeTextTag(tag.val);
      if (data?.role === 'furniture') logoPictures.push({index, data});
    }
  } catch { invalidRecord = true; }
  const tags = readTags(root['p:cSld']?.['p:custDataLst'], relationships, entries);
  if (!tags.tags.length && !records.length && !invalidRecord && !logoPictures.length) return candidates;
  let manifest;
  try {
    check(!tags.ambiguous && tags.tags.length === 1 && !invalidRecord, 'Missing or ambiguous furniture manifest/shape tags.');
    manifest = decodeTextTag(tags.tags[0].val);
    validateManifest(manifest);
    for (const record of records) {
      const data = record.data, part = manifest.parts[data?.part];
      check(data?.v === 1 && data.group === manifest.group && Number.isSafeInteger(data.part) && part && data.role === record.type && part.type === record.type, 'Unmatched furniture identity.');
    }
  } catch (error) { report(slideIndex, error.message); return candidates; }
  for (const kind of kinds) {
    const definition = manifest.definitions[kind];
    if (!definition) continue;
    try {
      const value = definition.value === false ? false : {};
      let removedNative = false;
      if (value !== false) for (const zone of zones) if (definition.value[zone] !== undefined) {
        value[zone] = Object.fromEntries(Object.entries(definition.value[zone]).filter(([, flag]) => flag === false));
      }
      const candidate = {scope: definition.scope, value, text: [], pictures: [], organizations: [], speakers: [], socials: [], sections: []};
      // logo: true returns as its flag; the generated picture is consumed, never content or an image field.
      for (const logo of (manifest.logos ?? []).filter(item => item.kind === kind)) {
        const found = logoPictures.filter(item => item.data.v === 1 && item.data.group === manifest.group && item.data.furniture === kind && item.data.zone === logo.zone);
        check(found.length <= 1, 'Duplicated furniture logo.');
        if (found.length) { candidate.pictures.push(found[0].index); value[logo.zone].logo = true; }
        else if (!logo.drawn) value[logo.zone].logo = true;
      }
      for (const [partIndex, part] of manifest.parts.entries()) {
        if (part.kind !== kind) continue;
        const group = records.filter(record => record.data.part === partIndex);
        // A native placeholder PowerPoint's Header & Footer dialog removed is a deliberate removal, not damage.
        if (part.ph !== undefined && group.length === 0) { removedNative = true; continue; }
        check(group.length === part.count, 'Incomplete or duplicated furniture part.');
        if (part.type === 'image') {
          const current = readPicture(pictures[group[0].index]);
          check(current?.kind === 'image', 'Furniture image is no longer recoverable.');
          value[part.zone].image = current.payload.image;
          candidate.pictures.push(group[0].index);
        } else {
          const ordered = Array(part.count);
          for (const record of group) {
            const {line, count} = record.data;
            check(count === part.count && Number.isSafeInteger(line) && line >= 0 && line < part.count && !ordered[line], 'Ambiguous furniture line.');
            ordered[line] = record;
          }
          const text = sourceLineParagraphs(ordered, paragraphs)[0].text;
          const format = manifest.formats?.[`${kind}.${part.zone}`] ?? {};
          if (part.field === 'slideNumber') {
            // The live field renumbers in PowerPoint; any fixed text around it
            // must still match the recorded format at this slide's position.
            check(text === formatSlideNumber(format.slideNumberFormat ?? '{current}', slideIndex + 1, slideCount), 'Current slide number differs from its position; retain the visible number as ordinary text.');
            if (format.slideNumberFormat !== undefined) value[part.zone].slideNumberFormat = format.slideNumberFormat;
          }
          if (part.field === 'section') candidate.sections.push(text);
          if (part.field === 'organization') candidate.organizations.push({id: manifest.organizationId, name: text});
          if (part.field === 'speaker') candidate.speakers.push(importedSpeaker(manifest.speakerId, text, part.nameLength));
          if (part.field === 'socials') {
            const lines = text.split('\n');
            check(lines.length === part.socials.length && lines.every(line => line.trim()), 'Current social profile lines no longer match their platforms.');
            candidate.socials.push({id: manifest.organizationId, socials: Object.fromEntries(part.socials.map((line, index) => [line.platform, line.scheme + lines[index]]))});
          }
          value[part.zone][part.field] = part.field === 'text' ? text : part.field === 'date' ? importedDate(definition.value[part.zone].date, format, text, ordered.flatMap(record => (paragraphs[record.index] ?? []).flatMap(paragraph => paragraph.fields ?? [])), value[part.zone], part.staticDate, ordered, paragraphs, message => report(slideIndex, `${kind}.${part.zone}.date: ${message}`)) : true;
          candidate.text.push(...ordered.map(record => record.index));
        }
      }
      check(new Set(candidate.text).size === candidate.text.length && new Set(candidate.pictures).size === candidate.pictures.length, 'Repeated furniture shape identity.');
      if (removedNative) {
        // The slide no longer follows the deck's definition: it is its own override, and the other slides can still agree.
        candidate.scope = 'local';
        candidate.derived = true;
        if (value !== false) {
          for (const zone of Object.keys(value)) if (!Object.keys(value[zone]).length) delete value[zone];
          if (!Object.keys(value).length) candidate.value = false;
        }
      }
      candidates[kind] = candidate;
    } catch (error) { report(slideIndex, `${kind}: ${error.message}`); }
  }
  return candidates;
}

// The generated speaker line is "Name, Title" (or "Name"). The recorded name length splits it again; a line edited in
// PowerPoint that no longer has the separator at that position is the visible text as the name, with no title.
function importedSpeaker(id, text, nameLength) {
  const rest = text.slice(nameLength);
  if (text.length > nameLength && rest.startsWith(', ') && rest.length > 2) return {id, name: text.slice(0, nameLength), title: rest.slice(2)};
  return {id, name: text};
}

// A current native date field wins. Full-mode static-wrap evidence can recover
// generated OPF intent without turning the existing PPTX text into a live field. A fixed
// date keeps its ISO value and pattern only when the current text round-trips.
// Otherwise the current words import as a literal date.
function importedDate(flag, format, text, nativeFields, zone, marker, ordered, paragraphs, report) {
  if (flag === true) {
    const pattern = nativeFields.length === 1 && nativeFields[0].text === text ? dateFormatForField[nativeFields[0].type] : undefined;
    if (pattern) {
      if (format.dateFormat !== undefined || pattern !== DEFAULT_DATE_FORMAT) zone.dateFormat = pattern;
      return true;
    }
    if (marker !== undefined) try {
      check(nativeFields.length === 0, 'A current native field no longer matches the static date evidence.');
      unchangedStaticDate(marker, format, ordered, paragraphs);
      if (format.dateFormat !== undefined) zone.dateFormat = format.dateFormat;
      return true;
    } catch (error) { report(`${error.message} Keep the current date as literal text.`); }
    return text;
  }
  const iso = format.dateFormat === undefined ? null : parseDate(text, format.dateFormat);
  if (iso) zone.dateFormat = format.dateFormat;
  return iso ?? text;
}

// Reconcile metadata before consuming any shapes. Global inheritance is promoted
// only when every slide has a valid definition/override and all inherited values
// agree. A missing tag must never cause another slide's furniture to reappear.
export function importFurniture(contexts, entries, onDiagnostic) {
  const report = (index, message) => onDiagnostic?.({code: 'invalid-furniture-provenance', path: `slides.${index}.design`, message: `${message} Ordinary import retains current native content; no old source words are restored.`});
  const taggedText = contexts.map(() => new Set());
  const candidates = contexts.map((context, index) => readSlide(context, entries, index, contexts.length, report, taggedText[index]));
  const organizations = candidates.flatMap(slide => Object.values(slide).flatMap(candidate => candidate.organizations));
  const organizationConflict = organizations.some(item => !same(item, organizations[0]));
  if (organizationConflict) {
    for (const [index, slide] of candidates.entries()) for (const kind of kinds) if (slide[kind]?.organizations.length) {
      delete slide[kind]; report(index, `${kind}: Current organization metadata disagrees across repeated fields.`);
    }
  }
  const speakers = candidates.flatMap(slide => Object.values(slide).flatMap(candidate => candidate.speakers));
  const speakerConflict = speakers.some(item => !same(item, speakers[0]));
  if (speakerConflict) {
    for (const [index, slide] of candidates.entries()) for (const kind of kinds) if (slide[kind]?.speakers.length) {
      delete slide[kind]; report(index, `${kind}: Current speaker metadata disagrees across repeated fields.`);
    }
  }
  for (const [index, slide] of candidates.entries()) {
    const sections = Object.values(slide).flatMap(candidate => candidate.sections);
    if (sections.some(section => section !== sections[0])) for (const kind of kinds) if (slide[kind]?.sections.length) {
      delete slide[kind]; report(index, `${kind}: Current section metadata disagrees on this slide.`);
    }
  }
  // Social profiles belong to the organization named by repeated furniture; without
  // that name (or with disagreeing values) the lines stay ordinary current text.
  const owner = candidates.flatMap(slide => Object.values(slide).flatMap(candidate => candidate.organizations))[0];
  const socials = candidates.flatMap(slide => Object.values(slide).flatMap(candidate => candidate.socials));
  if (socials.length && (!owner || socials.some(item => item.id !== owner.id || !same(item, socials[0])))) {
    for (const [index, slide] of candidates.entries()) for (const kind of kinds) if (slide[kind]?.socials.length) {
      delete slide[kind]; report(index, `${kind}: ${owner ? 'Current social profile metadata disagrees across repeated fields.' : 'Social profiles need a repeated organization name to rebuild organization metadata.'}`);
    }
  }
  // RR-11: PowerPoint's own date, footer and slide-number placeholders that no OPF tag claims (a deck authored in
  // PowerPoint, a placeholder the Header & Footer dialog added, a tag-stripped export) are footer furniture.
  contexts.forEach((context, index) => {
    const slide = candidates[index];
    const claimed = new Set([...taggedText[index], ...Object.values(slide).flatMap(candidate => candidate.text)]);
    const fields = readNativePlaceholders(context, claimed, context.relationshipsOf, context.readPart);
    if (!fields.length) return;
    const existing = slide.footer, accepted = [];
    for (const item of fields) {
      const current = existing && existing.value !== false ? existing.value[item.zone]?.[item.field] : undefined;
      if (current !== undefined && current !== false) report(index, `footer.${item.zone}.${item.field}: A native PowerPoint placeholder duplicates a furniture part already read; it stays ordinary current text.`);
      else accepted.push(item);
    }
    if (!accepted.length) return;
    const merged = footerValue(accepted), indexes = accepted.map(item => item.index);
    if (!existing) slide.footer = {scope: 'native', value: merged, text: indexes, pictures: [], organizations: [], speakers: [], socials: [], sections: []};
    else {
      if (existing.value === false) existing.value = {};
      for (const zone of Object.keys(merged)) existing.value[zone] = {...existing.value[zone], ...merged[zone]};
      existing.text.push(...indexes);
    }
  });
  const result = {design: {}, slides: candidates.map((slide, index) => {
    const values = Object.values(slide), sections = values.flatMap(candidate => candidate.sections);
    return {design: Object.fromEntries(Object.entries(slide).map(([kind, candidate]) => [kind, candidate.value])),
      ...(sections.length ? {section: sections[0]} : {}),
      text: new Set(values.flatMap(candidate => candidate.text)), pictures: new Set(values.flatMap(candidate => candidate.pictures)), taggedText: taggedText[index]};
  })};
  const validOrganizations = candidates.flatMap(slide => Object.values(slide).flatMap(candidate => candidate.organizations));
  if (validOrganizations.length) result.organization = validOrganizations[0];
  const validSocials = candidates.flatMap(slide => Object.values(slide).flatMap(candidate => candidate.socials));
  if (result.organization && validSocials.length) result.organization = {...result.organization, socials: validSocials[0].socials};
  // Stored document metadata (FF-32) must not override disagreeing visible names.
  if (organizationConflict) result.organizationConflict = true;
  const validSpeakers = candidates.flatMap(slide => Object.values(slide).flatMap(candidate => candidate.speakers));
  if (validSpeakers.length) result.speaker = validSpeakers[0];
  if (speakerConflict) result.speakerConflict = true;
  for (const kind of kinds) {
    const inherited = candidates.map(slide => slide[kind]).filter(candidate => candidate?.scope === 'global');
    if (inherited.length && candidates.every(slide => slide[kind]) && inherited.every(candidate => same(candidate.value, inherited[0].value))) {
      result.design[kind] = inherited[0].value;
      candidates.forEach((slide, index) => { if (slide[kind].scope === 'global') delete result.slides[index].design[kind]; });
    } else if (!inherited.length && candidates.every(slide => slide[kind]?.derived && same(slide[kind].value, candidates[0][kind].value))) {
      // Every slide's inherited definition lost the same native placeholder (the dialog's Apply to All): the deck's footer changed.
      result.design[kind] = candidates[0][kind].value;
      candidates.forEach((slide, index) => delete result.slides[index].design[kind]);
    }
  }
  // A deck with no OPF footer provenance (PowerPoint's Header & Footer dialog, another tool): the footer most slides share is the
  // deck's footer, a slide without one hides it, and any other slide keeps its own. One slide alone stays that slide's footer.
  const nativeFooters = candidates.map(slide => slide.footer);
  if (nativeFooters.some(Boolean) && nativeFooters.every(candidate => !candidate || candidate.scope === 'native')) {
    const counts = new Map();
    for (const candidate of nativeFooters) if (candidate && candidate.value !== false) {
      const found = counts.get(canonical(candidate.value)) ?? {value: candidate.value, count: 0};
      counts.set(canonical(candidate.value), {...found, count: found.count + 1});
    }
    const best = [...counts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
    if (best && (best[1].count >= 2 || contexts.length === 1)) {
      result.design.footer = best[1].value;
      nativeFooters.forEach((candidate, index) => {
        if (!candidate) result.slides[index].design.footer = false;
        else if (canonical(candidate.value) === best[0]) delete result.slides[index].design.footer;
      });
    }
  }
  candidates.forEach((slide, index) => { if (Object.keys(slide).length) onDiagnostic?.({code: 'furniture-import-reflow', path: `slides.${index}.design`, message: 'Complete furniture roles retain current text, source line boundaries, image content and unambiguous metadata. Native formatting, positioning, crop and other presentation metadata are not reconstructed; review the reflowed furniture.'}); });
  return result;
}
