// RR-105: static Open Packaging Conventions and PresentationML integrity checks for an exported PPTX, the defects that make
// PowerPoint refuse a file ("PowerPoint can't read ...", HRESULT 0x80CB8001) or offer to repair it, found without PowerPoint.
// packageIntegrity(entries) takes fflate's unzipSync output and returns [{rule, part, message}]; an empty list passes.
//
// Sources: ECMA-376 Part 2 (Open Packaging Conventions), Part 1 (PresentationML, DrawingML), and what PowerPoint does
// in practice where the standard is silent; each rule names its own. A rule that encodes PowerPoint behavior rather than
// a clause of the standard says so.
import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {drawingIdCollisions} from './drawing-id-collisions.mjs';

const RELATIONSHIPS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const PML = 'application/vnd.openxmlformats-officedocument.presentationml.';
const DML = 'application/vnd.openxmlformats-officedocument.drawingml.';
const decoder = new TextDecoder();
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, parseAttributeValue: false});
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const isXml = part => /\.(?:xml|rels|vml)$/i.test(part);
// ECMA-376 Part 2: part names compare ASCII case-insensitively.
const key = name => name.toLowerCase();

// Relationship types whose target must be owned by exactly one source part, with the content types they point at.
// The standard describes each of these as belonging to its source and PowerPoint writes one per owner; it does not
// state "at most one source" in so many words, so each entry records the evidence.
const SINGLE_OWNER = [
  // Part 1 (Tags): a tags part holds the tags of one owner (presentation, slide or shape) through its
  // custDataLst. RR-105 (2026-11-12): two slides relating one ppt/tags part, together with a duplicate override for it,
  // made PowerPoint 16.0.20527 refuse the deck.
  {type: REL + 'tags', what: 'tags part'},
  // Part 1 (Notes Slide): one notes slide per slide, and it relates back to that one slide.
  {type: REL + 'notesSlide', what: 'notes slide'},
  // Part 1 (Slide part): each slide is listed once in p:sldIdLst. A notes slide relates back to its slide with the same
  // relationship type, so only presentation -> slide relationships are counted.
  {type: REL + 'slide', what: 'slide', from: /^ppt\/presentation\.xml$/},
  // Part 1 (Slide Layout): a layout belongs to the one master that lists it in p:sldLayoutIdLst.
  // (Slides relate to their layout many-to-one; only master -> layout relationships are counted.)
  {type: REL + 'slideLayout', what: 'slide layout', from: /^ppt\/slideMasters\//},
  // Part 1 (Chart part): a chart part is the content of one graphic frame, and PowerPoint writes one per chart (its
  // Edit Data command rewrites that chart's own embedded workbook). Not verified in PowerPoint as an open failure.
  {type: REL + 'chart', what: 'chart'},
  {type: 'http://schemas.microsoft.com/office/2014/relationships/chartEx', what: 'chartEx chart'},
  // Part 1: the chart's embedded workbook (package relationship from a chart part) belongs to that chart. One graphic
  // frame can carry a chartEx in an mc:Choice and its classic c:chart in the mc:Fallback (Part 3, Markup Compatibility):
  // they are two forms of one chart and share its workbook, and PowerPoint opens those exports (the native acceptance
  // runs), so owners that are the alternates of one mc:AlternateContent are one owner.
  {type: REL + 'package', what: 'embedded workbook', from: /^ppt\/charts\//, alternates: true},
  // Part 1 (Comments): one comments part per slide.
  {type: REL + 'comments', what: 'comments part'},
];

// The content type a relationship's target must have, by relationship type (Part 1, each part's
// content type). Only the types an OPF export writes, so a mismatch is a writer defect, not an unknown part.
const TARGET_TYPE = {
  [REL + 'tags']: [PML + 'tags+xml'],
  [REL + 'slide']: [PML + 'slide+xml'],
  [REL + 'slideLayout']: [PML + 'slideLayout+xml'],
  [REL + 'slideMaster']: [PML + 'slideMaster+xml'],
  [REL + 'notesSlide']: [PML + 'notesSlide+xml'],
  [REL + 'notesMaster']: [PML + 'notesMaster+xml'],
  [REL + 'theme']: ['application/vnd.openxmlformats-officedocument.theme+xml'],
  [REL + 'chart']: [DML + 'chart+xml'],
  [REL + 'image']: [/^image\//],
};

// Which relationship type an r: attribute of a known element must resolve to (Part 1, the
// definitions of p:tags, p:custData, a:blip, c:chart, p:sldId, p:sldMasterId, p:sldLayoutId and p:notesMasterId).
const REFERENCE_TYPE = {
  'p:tags@id': [REL + 'tags'],
  'p:custData@id': [REL + 'customXml'],
  'a:blip@embed': [REL + 'image', 'http://schemas.microsoft.com/office/2007/relationships/hdphoto'],
  'a:blip@link': [REL + 'image'],
  'c:chart@id': [REL + 'chart'],
  'p:sldId@id': [REL + 'slide'],
  'p:sldMasterId@id': [REL + 'slideMaster'],
  'p:sldLayoutId@id': [REL + 'slideLayout'],
  'p:notesMasterId@id': [REL + 'notesMaster'],
};

function resolveTarget(source, target) {
  if (target.startsWith('/')) return target.slice(1);
  const segments = source.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '..') segments.pop();
    else if (segment !== '.' && segment !== '') segments.push(segment);
  }
  return segments.join('/');
}

// The part a relationships part describes: _rels/.rels is the package, a/b/_rels/c.xml.rels is a/b/c.xml.
const sourceOf = relsPart => relsPart === '_rels/.rels' ? '' : relsPart.replace(/(^|\/)_rels\/([^/]+)\.rels$/, '$1$2');

// True when every owner part is related from one part, and that part references them all inside one mc:AlternateContent.
function alternatesOfOneFrame(owners, incoming, xmlOf) {
  const links = owners.map(owner => (incoming.get(key(owner)) ?? []).filter(link => link.source));
  const sources = new Set(links.flat().map(link => link.source));
  if (sources.size !== 1 || links.some(list => !list.length)) return false;
  const [source] = sources;
  return [...xmlOf(source).matchAll(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g)]
    .some(([block]) => links.every(list => list.some(link => new RegExp(`:id="${link.id}"`).test(block))));
}

export function packageIntegrity(entries) {
  const findings = [], report = (rule, part, message) => findings.push({rule, part, message});
  const parts = Object.keys(entries).filter(name => !name.endsWith('/'));
  const text = new Map();
  const xmlOf = part => {
    if (!text.has(part)) text.set(part, decoder.decode(entries[part]));
    return text.get(part);
  };

  // Part 2: a package shall not contain equivalent (case-insensitively equal) part names.
  const byKey = new Map();
  for (const part of parts) {
    if (byKey.has(key(part))) report('equivalent-part-names', part, `${part} and ${byKey.get(key(part))} differ only in case.`);
    else byKey.set(key(part), part);
  }

  // Well-formed XML: every XML part is parsed by the consumer; a malformed one fails the whole package.
  for (const part of parts.filter(isXml)) {
    const valid = XMLValidator.validate(xmlOf(part));
    if (valid !== true) report('malformed-xml', part, `${valid.err.code}: ${valid.err.msg} (line ${valid.err.line})`);
  }

  // Part 2 (Content Types stream): every part has exactly one content type, from an Override for its name or
  // the Default for its extension. Two Overrides for one part name, or two Defaults for one extension, are invalid
  //; an Override for a part that is not in the package is invalid too.
  const contentTypes = new Map(), defaults = new Map();
  if (!entries['[Content_Types].xml']) report('content-types-missing', '[Content_Types].xml', 'The package has no [Content_Types].xml.');
  else {
    const types = parser.parse(xmlOf('[Content_Types].xml'))?.Types ?? {};
    for (const item of array(types.Default)) {
      const extension = key(String(item.Extension));
      if (defaults.has(extension)) report('duplicate-content-type-default', '[Content_Types].xml', `Two Default elements for the extension "${item.Extension}".`);
      defaults.set(extension, item.ContentType);
    }
    for (const item of array(types.Override)) {
      const name = String(item.PartName), part = name.replace(/^\//, '');
      if (contentTypes.has(key(part))) report('duplicate-content-type-override', '[Content_Types].xml', `Two Override elements for ${name}.`);
      contentTypes.set(key(part), item.ContentType);
      if (!byKey.has(key(part))) report('dangling-content-type-override', '[Content_Types].xml', `Override for ${name}, which is not in the package.`);
    }
  }
  const contentTypeOf = part => contentTypes.get(key(part)) ?? defaults.get(key(part.split('.').pop()));
  for (const part of parts) {
    if (part === '[Content_Types].xml') continue;
    if (!contentTypeOf(part)) report('part-without-content-type', part, `${part} has neither an Override nor a Default content type.`);
  }

  // Relationships: Part 2 (Relationships part). Ids are unique within one relationships part;
  // an internal target names a part of the package; a relationships part describes a part that exists.
  const relationships = new Map(), incoming = new Map();
  for (const relsPart of parts.filter(part => /(^|\/)_rels\/[^/]+\.rels$/.test(part))) {
    const source = sourceOf(relsPart);
    if (source && !byKey.has(key(source))) report('orphan-relationships-part', relsPart, `Relationships for ${source}, which is not in the package.`);
    const own = new Map();
    relationships.set(source, own);
    let parsed;
    try { parsed = parser.parse(xmlOf(relsPart))?.Relationships; } catch { continue; }
    for (const rel of array(parsed?.Relationship)) {
      const id = String(rel.Id), external = rel.TargetMode === 'External';
      if (own.has(id)) report('duplicate-relationship-id', relsPart, `Relationship id ${id} is used twice.`);
      const target = external ? undefined : resolveTarget(source, String(rel.Target));
      own.set(id, {type: rel.Type, target, external});
      if (external) continue;
      if (!byKey.has(key(target))) { report('missing-relationship-target', relsPart, `${id} (${rel.Type.split('/').pop()}) targets ${target}, which is not in the package.`); continue; }
      const expected = TARGET_TYPE[rel.Type];
      const actual = contentTypeOf(target);
      if (expected && actual && !expected.some(type => typeof type === 'string' ? type === actual : type.test(actual)))
        report('relationship-target-content-type', relsPart, `${id} is a ${rel.Type.split('/').pop()} relationship, but ${target} is ${actual}.`);
      const list = incoming.get(key(target)) ?? [];
      list.push({source, type: rel.Type, id});
      incoming.set(key(target), list);
    }
  }

  // Single-owner parts (SINGLE_OWNER above).
  for (const [target, links] of incoming) {
    for (const rule of SINGLE_OWNER) {
      const owners = new Set(links.filter(link => link.type === rule.type && (!rule.from || rule.from.test(link.source))).map(link => link.source));
      if (owners.size > 1 && !(rule.alternates && alternatesOfOneFrame([...owners], incoming, xmlOf))) report('shared-single-owner-part', byKey.get(target), `The ${rule.what} ${byKey.get(target)} is related from ${owners.size} parts: ${[...owners].join(', ')}.`);
    }
  }

  // References from markup: every attribute in the relationships namespace (r:id, r:embed, r:link, r:dm, r:pict ...)
  // names a relationship of its own part (Part 2, Relationships), and a known element's reference has the
  // relationship type that element requires (REFERENCE_TYPE). An empty r:id (a:hlinkClick for an action) refers to nothing.
  for (const part of parts.filter(part => /\.xml$/i.test(part) && part !== '[Content_Types].xml')) {
    const xml = xmlOf(part);
    const prefixes = [...xml.matchAll(/\bxmlns:([\w.-]+)="([^"]*)"/g)].filter(([, , uri]) => uri === RELATIONSHIPS_NS).map(([, prefix]) => prefix);
    if (!prefixes.length) continue;
    const own = relationships.get(part) ?? new Map();
    const attribute = new RegExp(`\\s(${prefixes.map(prefix => prefix.replace(/[.-]/g, '\\$&')).join('|')}):([\\w]+)="([^"]*)"`, 'g');
    for (const [, element, attributes] of xml.matchAll(/<([\w.-]+:[\w.-]+)\b((?:[^>"]|"[^"]*")*)>/g)) {
      for (const [, , local, id] of attributes.matchAll(attribute)) {
        if (!id) continue;
        const rel = own.get(id);
        if (!rel) { report('unresolved-relationship-reference', part, `<${element} r:${local}="${id}"> has no relationship ${id}.`); continue; }
        const expected = REFERENCE_TYPE[`${element}@${local}`];
        if (expected && !expected.includes(rel.type)) report('wrong-relationship-type', part, `<${element} r:${local}="${id}"> needs a ${expected.map(type => type.split('/').pop()).join(' or ')} relationship, but ${id} is ${rel.type.split('/').pop()}.`);
      }
    }
  }

  // Shape ids: Part 1 (p:cNvPr id) is unique within its slide, layout, master or notes slide; PowerPoint
  // repairs a duplicate. drawingIdCollisions honors mc:AlternateContent branches.
  for (const part of parts.filter(part => /^ppt\/(?:slides|slideLayouts|slideMasters|notesSlides|notesMasters)\/[^/]+\.xml$/.test(part))) {
    const ids = drawingIdCollisions(xmlOf(part));
    if (ids.length) report('duplicate-shape-id', part, `Shape ids used twice: ${ids.join(', ')}.`);
  }

  // Presentation id lists: Part 1 (the ST_SlideId and ST_SlideMasterId / ST_SlideLayoutId simple types): a p:sldId id is
  // in [256, 2147483648), a p:sldMasterId or p:sldLayoutId id is at least 2147483648. Master and layout ids share one
  // space and are unique across the presentation (PowerPoint repairs a collision between two masters' layouts).
  const presentation = entries['ppt/presentation.xml'] && xmlOf('ppt/presentation.xml');
  if (presentation) {
    const slideIds = [...presentation.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1]));
    if (new Set(slideIds).size !== slideIds.length) report('duplicate-slide-id', 'ppt/presentation.xml', 'Two p:sldId elements share an id.');
    for (const id of slideIds) if (id < 256 || id >= 2147483648) report('slide-id-range', 'ppt/presentation.xml', `p:sldId id ${id} is outside [256, 2147483648).`);
    const masterIds = [...presentation.matchAll(/<p:sldMasterId\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1]));
    const layoutIds = parts.filter(part => /^ppt\/slideMasters\/[^/]+\.xml$/.test(part)).flatMap(part => [...xmlOf(part).matchAll(/<p:sldLayoutId\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1])));
    const all = [...masterIds, ...layoutIds];
    if (new Set(all).size !== all.length) report('duplicate-master-layout-id', 'ppt/presentation.xml', 'A slide master or layout id is used twice across the presentation.');
    for (const id of all) if (id < 2147483648) report('master-layout-id-range', 'ppt/presentation.xml', `Master or layout id ${id} is below 2147483648.`);
  }
  return findings;
}
