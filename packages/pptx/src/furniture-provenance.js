import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag, encodeTextTag} from './code-provenance.js';
import {sourceLineParagraphs} from './text-provenance.js';
import {DEFAULT_DATE_FORMAT, NATIVE_DATE_FIELDS, formatSlideNumber, parseDate} from './furniture-fields.js';
import {schemas} from '@openpresentation/opf';

const TAG = 'OPF_FURNITURE_V1';
// A slide has one tag list; it also carries the document's OPF_SLIDE_V1 record.
const SLIDE_TAG = 'OPF_SLIDE_V1';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal: true});
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const kinds = ['header', 'footer'], zones = ['left', 'center', 'right'];
const fields = ['text', 'image', 'organization', 'socials', 'section', 'slideNumber', 'date'];
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (condition, message) => { if (!condition) throw Error(message); };

// This manifest contains topology, identities, inactive flags and format
// settings only. Current native shapes supply all words, image bytes and alt
// text, even after edits; a recorded format is kept only while the current text
// still matches it exactly.
export function furnitureManifest(presentation, slide, layout, slideIndex) {
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
  return {v: 1, role: 'slide', group: String(slideIndex), definitions, ...(Object.keys(formats).length ? {formats} : {}),
    ...(layout.parts.some(part => part.field === 'organization' || part.field === 'socials') ? {organizationId: organization?.id} : {}),
    parts: layout.parts.map(part => ({kind: part.kind, zone: part.zone, field: part.field,
      type: part.type, count: part.type === 'image' ? 1 : part.fit.lines.length,
      ...(part.field === 'socials' ? {socials: socialLines(part)} : {})}))};
}

export function attachFurnitureTags(entries, records, manifests) {
  attachTextTags(entries, records, TAG, 'opfFurniture', 'furniture', {pictures: true});
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
    if (part.field === 'socials') check(Array.isArray(part.socials) && part.socials.length >= 1 && part.socials.length <= 100
      && part.socials.every(line => object(line) && platformId.test(line.platform) && schemes.includes(line.scheme))
      && new Set(part.socials.map(line => line.platform)).size === part.socials.length, 'Invalid social profile lines.');
    else check(part.socials === undefined, 'Unexpected social profile lines.');
    expected.delete(key(part));
  }
  if (manifest.parts.some(part => part.field === 'organization' || part.field === 'socials')) check(typeof manifest.organizationId === 'string' && /^[a-zA-Z0-9_-]+$/.test(manifest.organizationId), 'Invalid organization identity.');
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
  const tags = readTags(root['p:cSld']?.['p:custDataLst'], relationships, entries);
  if (!tags.tags.length && !records.length && !invalidRecord) return candidates;
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
      if (value !== false) for (const zone of zones) if (definition.value[zone] !== undefined) {
        value[zone] = Object.fromEntries(Object.entries(definition.value[zone]).filter(([, flag]) => flag === false));
      }
      const candidate = {scope: definition.scope, value, text: [], pictures: [], organizations: [], socials: [], sections: []};
      for (const [partIndex, part] of manifest.parts.entries()) {
        if (part.kind !== kind) continue;
        const group = records.filter(record => record.data.part === partIndex);
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
          if (part.field === 'socials') {
            const lines = text.split('\n');
            check(lines.length === part.socials.length && lines.every(line => line.trim()), 'Current social profile lines no longer match their platforms.');
            candidate.socials.push({id: manifest.organizationId, socials: Object.fromEntries(part.socials.map((line, index) => [line.platform, line.scheme + lines[index]]))});
          }
          value[part.zone][part.field] = part.field === 'text' ? text : part.field === 'date' ? importedDate(definition.value[part.zone].date, format, text, ordered.flatMap(record => (paragraphs[record.index] ?? []).flatMap(paragraph => paragraph.fields ?? [])), value[part.zone]) : true;
          candidate.text.push(...ordered.map(record => record.index));
        }
      }
      check(new Set(candidate.text).size === candidate.text.length && new Set(candidate.pictures).size === candidate.pictures.length, 'Repeated furniture shape identity.');
      candidates[kind] = candidate;
    } catch (error) { report(slideIndex, `${kind}: ${error.message}`); }
  }
  return candidates;
}

// A current date stays live only while its shape still holds exactly one
// PowerPoint date field; the field's current type selects the pattern. A fixed
// date keeps its ISO value and pattern only when the current text round-trips.
// Otherwise the current words import as a literal date.
function importedDate(flag, format, text, nativeFields, zone) {
  if (flag === true) {
    const pattern = nativeFields.length === 1 && nativeFields[0].text === text ? dateFormatForField[nativeFields[0].type] : undefined;
    if (pattern) {
      if (format.dateFormat !== undefined || pattern !== DEFAULT_DATE_FORMAT) zone.dateFormat = pattern;
      return true;
    }
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
  for (const kind of kinds) {
    const inherited = candidates.map(slide => slide[kind]).filter(candidate => candidate?.scope === 'global');
    if (inherited.length && candidates.every(slide => slide[kind]) && inherited.every(candidate => same(candidate.value, inherited[0].value))) {
      result.design[kind] = inherited[0].value;
      candidates.forEach((slide, index) => { if (slide[kind].scope === 'global') delete result.slides[index].design[kind]; });
    }
  }
  candidates.forEach((slide, index) => { if (Object.keys(slide).length) onDiagnostic?.({code: 'furniture-import-reflow', path: `slides.${index}.design`, message: 'Complete furniture roles retain current text, source line boundaries, image content and unambiguous metadata. Native formatting, positioning, crop and other presentation metadata are not reconstructed; review the reflowed furniture.'}); });
  return result;
}
