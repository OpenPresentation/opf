// RR-72: header and footer furniture on the slide master and layouts (docs/native-header-footer.md, "Master furniture").
//
// Furniture parts PowerPoint has no placeholder for (a logo or other zone image, socials, header text, footer text
// other than the one native `ftr`) are drawn by core on every slide. When a part is drawn the same on two or more slides
// (the same XML: content, box, style, picture bytes), it is written once instead:
//
// - on the slide master, when it is the same on every slide that shows liftable furniture (two or more slides);
// - on a layout (a copy of the master's layout, with RR-11's placeholders), when it is shared by two or more slides
//   but not by all of them: one layout per distinct set, so a logo with onLight/onDark variants gets one layout per
//   background tone, and a section's header text one layout per section;
// - a slide that shows none of the master's parts (its footer hidden, `design.footer: false`) uses a layout whose
//   `showMasterSp="0"` hides the master's furniture.
//
// A part stays an ordinary shape on its slide when it is drawn on that slide only (nothing repeats, a one-slide deck
// included), when it holds a live field (a header slide number or current date: its cached value is per slide) or when
// slide content overlaps its box: PowerPoint draws master and layout shapes beneath every slide shape, while core paints
// furniture above content, so such a part stays above the content on its slide (`furniture-on-slide` diagnostic).
//
// Provenance. A lifted shape keeps its OPF_FURNITURE_V1 tag, with the slot (`footer.left.image`) in place of the slide
// group and part. Each slide's manifest moves the part (its topology entry, the definition's flag, and its stored text
// template or logo reference) into `shared`, keyed by slot, with `on: 'master' | 'layout'`; importers before 0.18,
// which read only slide shapes, ignore `shared` and read the rest of the slide's furniture as before.

import {decodeTextTag, encodeTextTag} from './code-provenance.js';

const dec = new TextDecoder('utf-8', {fatal: true}), enc = new TextEncoder();
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const TAGS_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.tags+xml';
const LAYOUT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml';
const NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const TAG = 'OPF_FURNITURE_V1';

const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');
const attribute = (xml, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(xml)?.[1];
const escapeAttribute = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const unescapeAttribute = value => value.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function resolvePart(source, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = source.split('/').slice(0, -1);
  for (const piece of target.split('/')) {
    if (piece === '..') parts.pop();
    else if (piece !== '.' && piece) parts.push(piece);
  }
  return parts.join('/');
}

function relativeTarget(source, path) {
  const from = source.split('/').slice(0, -1), to = path.split('/');
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++;
  return [...Array(from.length - common).fill('..'), ...to.slice(common)].join('/');
}

// The relationships of one part: [{node, id, type, target, external, path}].
function relationships(xml) {
  return [...xml.matchAll(/<Relationship\b[^>]*\/>/g)].map(([node]) => ({node, id: attribute(node, 'Id'), type: attribute(node, 'Type') ?? '',
    target: unescapeAttribute(attribute(node, 'Target') ?? ''), external: attribute(node, 'TargetMode') === 'External'}));
}

// Top-level text shapes and pictures by object name (generated furniture is never grouped).
const shapeElements = xml => [...xml.matchAll(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g)].map(match => ({xml: match[0], kind: match[1], name: unescapeAttribute(match[0].match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '')}));
const RELATIONSHIP_ATTRIBUTE = /\br:(embed|link|id|pict)="([^"]*)"/g;

function bounds(xml) {
  const boxes = [...xml.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/g)].map(match => match.slice(1).map(Number));
  if (!boxes.length) return undefined;
  const left = Math.min(...boxes.map(box => box[0])), top = Math.min(...boxes.map(box => box[1]));
  return {left, top, right: Math.max(...boxes.map(box => box[0] + box[2])), bottom: Math.max(...boxes.map(box => box[1] + box[3]))};
}
const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;

/**
 * Write the furniture that repeats across slides once, on the slide master or a layout. `output` maps a package path to
 * [bytes, zipOptions] (the finished, normalized package; per-script masters already exist). `slides[i]` describes slide i:
 * `{path, parts: [{index, kind, zone, field, type, names, native, path}]}`, the core furniture parts in manifest order with the
 * object names of their shapes (one per text line). `report` receives export diagnostics.
 */
export function liftMasterFurniture(output, slides, report = () => {}) {
  const has = path => Object.hasOwn(output, path);
  const read = path => dec.decode(output[path][0]);
  const options = output['ppt/presentation.xml'][1];
  const write = (path, xml) => { output[path] = [enc.encode(xml), output[path]?.[1] ?? options]; };
  let types = read('[Content_Types].xml');
  const relsCache = new Map();
  const rels = path => {
    if (!relsCache.has(path)) relsCache.set(path, has(relsOf(path)) ? relationships(read(relsOf(path))) : []);
    return relsCache.get(path);
  };
  const related = (path, type) => {
    const rel = rels(path).find(item => !item.external && item.type === `${REL}/${type}`);
    return rel ? resolvePart(path, rel.target) : undefined;
  };

  // 1. Each slide's candidates: slot -> {signature, box, shapes, part}; and the parts content overlaps.
  const plans = [];
  for (const [slideIndex, slide] of slides.entries()) {
    if (!slide || !has(slide.path)) continue;
    const xml = read(slide.path), layout = related(slide.path, 'slideLayout'), master = layout && related(layout, 'slideMaster');
    if (!layout || !master) continue;
    const elements = new Map(shapeElements(xml).map(element => [element.name, element]));
    const furnitureNames = new Set(slide.parts.flatMap(part => part.names));
    // Every other shape's frame: furniture under any of them keeps its paint order on the slide.
    let others = xml;
    for (const element of shapeElements(xml)) if (furnitureNames.has(element.name)) others = others.replace(element.xml, '');
    const occupied = [...others.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/g)]
      .map(match => match.slice(1).map(Number)).filter(([, , cx, cy]) => cx > 0 || cy > 0)
      // A line has no area: one unit across, so a rule through the band still counts.
      .map(([x, y, cx, cy]) => ({left: x, top: y, right: x + Math.max(cx, 1), bottom: y + Math.max(cy, 1)}));
    const relationOf = id => {
      const rel = rels(slide.path).find(item => item.id === id);
      return rel ? `${rel.type}|${rel.external ? `external:${rel.target}` : resolvePart(slide.path, rel.target)}` : `missing:${id}`;
    };
    const candidates = new Map(), pinned = new Set();
    for (const part of slide.parts) {
      if (part.native || !part.names.length) continue;
      const shapes = part.names.map(name => elements.get(name));
      if (shapes.some(shape => !shape || shape.kind !== (part.type === 'image' ? 'pic' : 'sp'))) continue;
      if (shapes.some(shape => /<a:fld\b/.test(shape.xml))) continue;
      const box = bounds(shapes.map(shape => shape.xml).join(''));
      if (!box) continue;
      // Drawn content and box: the shape XML without its object id, name and tags, relationship ids read as their targets.
      const signature = shapes.map(shape => shape.xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, '')
        .replace(/(<p:cNvPr\b[^>]*?)\s(?:id|name)="[^"]*"/g, '$1').replace(/(<p:cNvPr\b[^>]*?)\s(?:id|name)="[^"]*"/g, '$1')
        .replace(RELATIONSHIP_ATTRIBUTE, (match, kind, id) => `r:${kind}="${relationOf(id)}"`)).join('\n');
      const slot = `${part.kind}.${part.zone}.${part.field}`;
      candidates.set(slot, {slot, signature, part, shapes, box});
      if (occupied.some(frame => overlaps(frame, box))) pinned.add(slot);
    }
    plans.push({slideIndex, slide, xml, layout, master, candidates, pinned});
  }
  if (!plans.length) return;
  // One report per part (its authored path), naming the slides where content covers it.
  const covered = new Map();
  for (const plan of plans) for (const slot of plan.pinned) {
    const part = plan.candidates.get(slot).part;
    covered.set(part.path, {part, slides: [...(covered.get(part.path)?.slides ?? []), plan.slideIndex + 1]});
  }
  for (const [path, {part, slides: numbers}] of covered) report({code: 'furniture-on-slide', path, message: `Slide content overlaps the ${part.kind} ${part.zone} ${part.field} on slide${numbers.length > 1 ? 's' : ''} ${numbers.join(', ')}. PowerPoint draws slide master and layout shapes beneath slide content, so there this part stays a shape on the slide, drawn above the content as in the preview.`});

  // 2. Per slide master: the master's parts, each slide's layout key, and the layouts to create.
  const value = (plan, slot) => plan.candidates.get(slot)?.signature;
  const free = (plan, slot) => plan.candidates.has(slot) && !plan.pinned.has(slot);
  const id = (slot, signature) => `${slot}\u0000${signature}`;
  const assignments = [];
  for (const master of [...new Set(plans.map(plan => plan.master))]) {
    const group = plans.filter(plan => plan.master === master);
    const showing = group.filter(plan => plan.candidates.size);
    // The master holds the parts drawn the same on every slide that shows liftable furniture.
    let common = showing.length >= 2 ? [...showing[0].candidates.keys()].filter(slot => showing.every(plan => value(plan, slot) === value(showing[0], slot))) : [];
    if (!showing.some(plan => common.every(slot => free(plan, slot)))) common = [];
    const counts = new Map();
    for (const plan of group) for (const [slot, candidate] of plan.candidates) if (free(plan, slot)) counts.set(id(slot, candidate.signature), (counts.get(id(slot, candidate.signature)) ?? 0) + 1);
    const layouts = new Map();
    for (const plan of group) {
      const showsMaster = plan.candidates.size ? common.every(slot => free(plan, slot)) : !common.length;
      const extras = [...plan.candidates.keys()].filter(slot => free(plan, slot) && (showsMaster ? !common.includes(slot) && counts.get(id(slot, value(plan, slot))) >= 2
        : common.includes(slot) || counts.get(id(slot, value(plan, slot))) >= 2)).sort();
      const key = `${plan.layout}\u0002${showsMaster ? 1 : 0}\u0001${extras.map(slot => id(slot, value(plan, slot))).join('\u0001')}`;
      plan.extras = extras;
      plan.lifted = new Map([...(showsMaster ? common.map(slot => [slot, 'master']) : []), ...extras.map(slot => [slot, 'layout'])]);
      plan.layoutKey = showsMaster && !extras.length ? undefined : key;
      if (plan.layoutKey !== undefined && !layouts.has(key)) layouts.set(key, {showsMaster, source: plan, slides: []});
      if (plan.layoutKey !== undefined) layouts.get(key).slides.push(plan);
    }
    assignments.push({master, group, common, layouts});
  }
  if (!assignments.some(item => item.common.length || item.layouts.size)) return;

  // 3. Write: the master's shapes, the new layouts, and each slide without its lifted shapes.
  const tagPart = n => `ppt/tags/opfFurnitureShared${n}.xml`;
  let tagNumber = 0, nextLayout = Math.max(0, ...Object.keys(output).map(path => Number(/^ppt\/slideLayouts\/slideLayout(\d+)\.xml$/.exec(path)?.[1] ?? 0))) + 1;
  const presentation = read('ppt/presentation.xml');
  const usedIds = [...presentation.matchAll(/<p:sldMasterId\b[^>]*\bid="(\d+)"/g), ...Object.keys(output).filter(path => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path))
    .flatMap(path => [...read(path).matchAll(/<p:sldLayoutId\b[^>]*\bid="(\d+)"/g)])].map(match => Number(match[1]));
  let nextLayoutId = Math.max(2147483648, ...usedIds) + 1;
  const pending = new Map(); // part path -> {xml, rels}
  const partXml = path => pending.get(path)?.xml ?? read(path);
  const partRels = path => pending.get(path)?.rels ?? (has(relsOf(path)) ? read(relsOf(path)) : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
  const stage = (path, xml, relsXml) => pending.set(path, {xml, rels: relsXml});
  const relationshipId = (relsXml, type, target, external) => {
    const existing = relationships(relsXml).find(rel => rel.type === type && rel.target === target && rel.external === external);
    if (existing) return {relsXml, rid: existing.id};
    const taken = new Set(relationships(relsXml).map(rel => rel.id));
    let n = 1, rid;
    do rid = `rId${n++}`; while (taken.has(rid));
    return {rid, relsXml: relsXml.replace('</Relationships>', `<Relationship Id="${rid}" Type="${type}" Target="${escapeAttribute(target)}"${external ? ' TargetMode="External"' : ''}/></Relationships>`)};
  };

  // Copy one slide's shapes of a slot into a master or layout, with its relationships and a slot tag.
  const transplant = (target, plan, slot) => {
    const candidate = plan.candidates.get(slot);
    let xml = partXml(target), relsXml = partRels(target);
    let nextId = Math.max(0, ...[...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1]))) + 1;
    const copies = candidate.shapes.map((shape, line) => {
      let copy = shape.xml;
      // The tag: the slide record with the slot in place of the slide's group and part.
      const tagId = copy.match(/<p:custDataLst>\s*<p:tags r:id="([^"]+)"\/>\s*<\/p:custDataLst>/)?.[1];
      copy = copy.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, '');
      copy = copy.replace(RELATIONSHIP_ATTRIBUTE, (match, kind, rid) => {
        if (!rid) return match;
        const rel = rels(plan.slide.path).find(item => item.id === rid);
        if (!rel) throw new Error(`Furniture shape relationship ${rid} is missing.`);
        const result = relationshipId(relsXml, rel.type, rel.external ? rel.target : relativeTarget(target, resolvePart(plan.slide.path, rel.target)), rel.external);
        relsXml = result.relsXml;
        return `r:${kind}="${result.rid}"`;
      });
      const tagRel = tagId && rels(plan.slide.path).find(item => item.id === tagId);
      if (tagRel) {
        const source = resolvePart(plan.slide.path, tagRel.target), record = decodeTextTag(read(source).match(/\bval="([^"]*)"/)[1]);
        const {group, part, ...rest} = record;
        const path = tagPart(++tagNumber);
        output[path] = [enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:p="${NS}"><p:tag name="${TAG}" val="${encodeTextTag({...rest, slot})}"/></p:tagLst>`), options];
        types = types.replace('</Types>', `<Override PartName="/${path}" ContentType="${TAGS_TYPE}"/></Types>`);
        const result = relationshipId(relsXml, `${REL}/tags`, relativeTarget(target, path), false);
        relsXml = result.relsXml;
        copy = copy.replace(/<p:nvPr\s*\/>/, '<p:nvPr></p:nvPr>').replace('</p:nvPr>', `<p:custDataLst><p:tags r:id="${result.rid}"/></p:custDataLst></p:nvPr>`);
      }
      const name = `OPF furniture ${slot.replace(/\./g, ' ')}${candidate.part.type === 'text' ? ` line ${line}` : ''}`;
      return copy.replace(/(<p:cNvPr\b[^>]*?\bid=")\d+(")/, `$1${nextId++}$2`).replace(/(<p:cNvPr\b[^>]*?\bname=")[^"]*(")/, `$1${escapeAttribute(name)}$2`);
    });
    const end = xml.lastIndexOf('</p:spTree>');
    if (end < 0) throw new Error(`${target} has no shape tree.`);
    stage(target, xml.slice(0, end) + copies.join('') + xml.slice(end), relsXml);
  };

  for (const {master, group, common, layouts} of assignments) {
    const showing = group.find(plan => common.every(slot => free(plan, slot)) && plan.candidates.size);
    for (const slot of common) transplant(master, showing, slot);
    // The layout a slide uses now, copied once per layout key: the master's one layout, or the slide's 0.19 template layout (RR-81),
    // whose variant keeps its placeholders and its OPF_LAYOUT_V1 tag (`Pillars (no furniture)`).
    let masterXml = partXml(master), masterRels = partRels(master);
    let number = 0;
    const templateNumbers = new Map();
    for (const layout of layouts.values()) {
      const base = layout.source.layout;
      const path = `ppt/slideLayouts/slideLayout${nextLayout++}.xml`;
      const baseRels = has(relsOf(base)) ? read(relsOf(base)) : '';
      const tagRels = relationships(baseRels).filter(rel => rel.type === `${REL}/tags` && !rel.external);
      const baseName = unescapeAttribute(read(base).match(/<p:cSld\b[^>]*\bname="([^"]*)"/)?.[1] ?? '');
      let name;
      if (tagRels.length) {
        const count = (templateNumbers.get(base) ?? 0) + (layout.source.extras.length ? 1 : 0);
        templateNumbers.set(base, count);
        name = layout.source.extras.length ? `${baseName} (furniture ${count})` : `${baseName} (no furniture)`;
      } else name = layout.source.extras.length ? `OPF furniture ${++number}` : 'OPF no furniture';
      let xml = read(base).replace(/(<p:cSld\b[^>]*?\bname=")[^"]*(")/, `$1${escapeAttribute(name)}$2`);
      if (!layout.showsMaster) xml = xml.replace(/<p:sldLayout\b[^>]*>/, open => `${open.slice(0, -1).replace(/\s+showMasterSp="[^"]*"/, '')} showMasterSp="0">`);
      // A copied layout keeps only its master relationship and its own tags (a copy of each tag part); the furniture brings its own.
      const masterRel = relationships(baseRels).find(rel => rel.type === `${REL}/slideMaster`);
      if (!masterRel) throw new Error(`${base} has no slide master relationship.`);
      let copiedRels = masterRel.node;
      for (const rel of tagRels) {
        const source = resolvePart(base, rel.target);
        let n = 0, copy;
        do copy = `ppt/tags/opfLayoutVariant${++n}.xml`; while (has(copy));
        output[copy] = [output[source][0], options];
        types = types.replace('</Types>', `<Override PartName="/${copy}" ContentType="${TAGS_TYPE}"/></Types>`);
        copiedRels += `<Relationship Id="${rel.id}" Type="${REL}/tags" Target="${escapeAttribute(relativeTarget(path, copy))}"/>`;
      }
      stage(path, xml, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${copiedRels}</Relationships>`);
      types = types.replace('</Types>', `<Override PartName="/${path}" ContentType="${LAYOUT_TYPE}"/></Types>`);
      for (const slot of layout.source.extras) transplant(path, layout.source, slot);
      const result = relationshipId(masterRels, `${REL}/slideLayout`, relativeTarget(master, path), false);
      masterRels = result.relsXml;
      if (!masterXml.includes('</p:sldLayoutIdLst>')) throw new Error(`${master} has no layout list.`);
      masterXml = masterXml.replace('</p:sldLayoutIdLst>', `<p:sldLayoutId id="${nextLayoutId++}" r:id="${result.rid}"/></p:sldLayoutIdLst>`);
      layout.path = path;
    }
    stage(master, masterXml, masterRels);

    // Each slide: drop its lifted shapes (and what only they referenced), point it at its layout, and move the manifest entries.
    for (const plan of group) {
      if (!plan.lifted.size && plan.layoutKey === undefined) continue;
      let xml = plan.xml, relsXml = read(relsOf(plan.slide.path));
      // The relationships only the removed shapes used (their tags, pictures and links) go with them.
      const released = new Set();
      for (const slot of plan.lifted.keys()) for (const shape of plan.candidates.get(slot).shapes) {
        for (const match of shape.xml.matchAll(RELATIONSHIP_ATTRIBUTE)) released.add(match[2]);
        xml = xml.replace(shape.xml, '');
      }
      for (const rel of relationships(relsXml)) {
        if (!released.has(rel.id) || new RegExp(`"${escapeRegExp(rel.id)}"`).test(xml)) continue;
        relsXml = relsXml.replace(rel.node, '');
        if (rel.type === `${REL}/tags`) {
          const path = resolvePart(plan.slide.path, rel.target);
          delete output[path];
          types = types.replace(`<Override PartName="/${path}" ContentType="${TAGS_TYPE}"/>`, '');
        }
      }
      if (plan.layoutKey !== undefined) {
        const target = relativeTarget(plan.slide.path, layoutsFor(assignments, plan).path);
        relsXml = relsXml.replace(/<Relationship\b[^>]*\/>/g, node => attribute(node, 'Type') === `${REL}/slideLayout` ? node.replace(/\sTarget="[^"]*"/, ` Target="${target}"`) : node);
      }
      moveManifestEntries(output, plan, read, write);
      write(plan.slide.path, xml);
      write(relsOf(plan.slide.path), relsXml);
    }
  }
  for (const [path, {xml, rels: relsXml}] of pending) { write(path, xml); write(relsOf(path), relsXml); }
  write('[Content_Types].xml', types);
}

function layoutsFor(assignments, plan) {
  return assignments.find(item => item.group.includes(plan)).layouts.get(plan.layoutKey);
}

// The slide's manifest: each lifted part leaves `parts`, `definitions` (its flag), `templates` and `images` for `shared`, and the
// remaining parts are renumbered in the slide's own shape tags, so an importer that does not know `shared` reads the slide as it is.
function moveManifestEntries(output, plan, read, write) {
  const path = `ppt/tags/opfFurnitureSlide${plan.slideIndex}.xml`;
  if (!Object.hasOwn(output, path) || !plan.lifted.size) return;
  const manifest = decodeTextTag(read(path).match(/\bval="([^"]*)"/)[1]);
  const shared = {}, keep = [], renumber = new Map();
  for (const [index, part] of manifest.parts.entries()) {
    const slot = `${part.kind}.${part.zone}.${part.field}`, on = plan.lifted.get(slot);
    if (!on) { renumber.set(index, keep.length); keep.push(part); continue; }
    const zone = manifest.definitions[part.kind].value[part.zone];
    const entry = {...part, on, flag: zone[part.field]};
    delete zone[part.field];
    const key = `${part.kind}.${part.zone}`;
    if (part.field === 'text' && manifest.templates?.[key] !== undefined) { entry.template = manifest.templates[key]; delete manifest.templates[key]; }
    if (part.field === 'image' && manifest.images?.[key] !== undefined) { entry.image = manifest.images[key]; delete manifest.images[key]; }
    shared[slot] = entry;
  }
  for (const name of ['templates', 'images']) if (manifest[name] && !Object.keys(manifest[name]).length) delete manifest[name];
  manifest.parts = keep;
  manifest.shared = shared;
  write(path, read(path).replace(/\bval="[^"]*"/, () => `val="${encodeTextTag(manifest)}"`));
  // Renumber the slide's remaining furniture shape tags.
  const slideRels = relationships(read(relsOf(plan.slide.path)));
  const remaining = new Set(plan.slide.parts.filter(part => !plan.lifted.has(`${part.kind}.${part.zone}.${part.field}`)).flatMap(part => part.names));
  for (const element of shapeElements(plan.xml)) {
    if (!remaining.has(element.name)) continue;
    const tagId = element.xml.match(/<p:custDataLst>\s*<p:tags r:id="([^"]+)"\/>/)?.[1];
    const rel = tagId && slideRels.find(item => item.id === tagId);
    if (!rel) continue;
    const tag = resolvePart(plan.slide.path, rel.target);
    const record = decodeTextTag(read(tag).match(/\bval="([^"]*)"/)[1]);
    if (record.part === undefined || !renumber.has(record.part) || renumber.get(record.part) === record.part) continue;
    write(tag, read(tag).replace(/\bval="[^"]*"/, () => `val="${encodeTextTag({...record, part: renumber.get(record.part)})}"`));
  }
}
