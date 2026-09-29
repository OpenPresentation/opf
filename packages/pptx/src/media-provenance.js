import {XMLParser} from 'fast-xml-parser';
import {validatePresentation} from '@openpresentation/opf';
import {attachTextTags, decodeTextTag} from './code-provenance.js';

// A video payload exports as the preview's placeholder: a frame, a play badge,
// a play triangle and caption lines (FF-29). PPTX has no native field for the
// OPF video value, so every shape of the group carries one OPF_MEDIA_V1 shape
// tag unless provenance is off. Full-mode frames hold storable authored values;
// references-only frames carry no source or metadata. Import recognizes an
// unchanged, fully tagged group and rebuilds the video block; any other tagged
// group drops only its tagged decoration shapes, keeps the caption text and
// reports invalid-media-provenance. A shape name alone never removes a shape.
const TAG = 'OPF_MEDIA_V1', REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const ROLES = ['frame', 'badge', 'play', 'caption'];
const MAX_VALUE_BYTES = 256 * 1024;
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const decoder = new TextDecoder('utf-8', {fatal: true}), encoder = new TextEncoder();
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const visibleWords = value => String(value).replace(/\s+/g, ' ').trim();
const canonical = value => JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const sizeOf = value => encoder.encode(JSON.stringify(value)).byteLength;
const sourceOf = value => typeof value === 'string' ? value : value?.src;
const webSource = source => typeof source === 'string' && /^https?:\/\//i.test(source) ? source : null;
const hasData = value => typeof value === 'string' ? /^data:/i.test(value) : Array.isArray(value) ? value.some(hasData) : object(value) && Object.values(value).some(hasData);
const mediaPath = path => typeof path === 'string' && /^slides\.\d+\.(?:blocks\.\d+\.)*video$/.test(path);
const currentPath = (path, slideIndex) => path.replace(/^slides\.\d+/, `slides.${slideIndex}`);

// Exact emitted-line change detection, not authentication: tags remain writable.
// Full mode stores no caption words here. References-only carries line
// structure alone and derives its caption from the current native text.
export function mediaTextFingerprint(text) {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let index = 0; index < text.length; index++) {
    a = Math.imul(a ^ text.charCodeAt(index), 2654435761);
    b = Math.imul(b ^ text.charCodeAt(index), 1597334677);
  }
  return `${text.length}:${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

function resolvedSource(value, assets) {
  let source = sourceOf(value);
  const seen = new Set();
  while (typeof source === 'string' && source.startsWith('asset:')) {
    const id = source.slice(6);
    if (seen.has(id) || !Object.hasOwn(assets, id)) return undefined;
    seen.add(id);
    source = sourceOf(assets[id]);
  }
  return source;
}

/** The caption the placeholder shows: title, else source, else "Media". */
export function mediaCaption(value) {
  const asset = typeof value === 'string' ? {src: value} : object(value) ? value : {src: ''};
  return asset.title || asset.src || 'Media';
}

/**
 * The frame record: the authored value and, in 'full' provenance mode, the
 * asset registry entries it references (without data: sources), so an
 * `asset:` reference still resolves after import. Data: sources and oversized
 * values are omitted with a diagnostic. References-only stores only identity;
 * its imported value comes from the current native hyperlink and caption.
 */
export function mediaFrameRecord(value, path, presentation, mode, report = () => {}) {
  const record = {v: 1, role: 'frame', path};
  if (mode === 'references-only') return {...record, nativeOnly: true};
  const omit = reason => {
    report({code: 'media-provenance-omitted', path, message: `The video value is not stored in the PPTX because ${reason}; import keeps current native content.`});
    // Late checks run after video/assets are added. Omission is identity-only.
    return {v: 1, role: 'frame', path, omitted: true};
  };
  if (hasData(value)) return omit('it embeds a data: source without an exported media part');
  if (sizeOf(value) > MAX_VALUE_BYTES) return omit('it exceeds the media provenance size limit');
  record.video = value;
  if (mode === 'full') {
    const assets = Object.create(null);
    let source = typeof value === 'string' ? value : value?.src;
    for (let depth = 0; typeof source === 'string' && source.startsWith('asset:') && depth < 8; depth++) {
      const id = source.slice(6), asset = presentation.assets?.[id];
      if (asset === undefined || Object.hasOwn(assets, id) || hasData(asset) || sizeOf(asset) > MAX_VALUE_BYTES) return omit('a referenced asset cannot be stored');
      assets[id] = asset;
      source = typeof asset === 'string' ? asset : asset?.src;
    }
    if (Object.keys(assets).length) record.assets = assets;
    if (resolvedSource(value, assets) === undefined) return omit('a referenced asset cannot be resolved');
  }
  if (sizeOf(record) > MAX_VALUE_BYTES) return omit('it exceeds the media provenance size limit');
  return record;
}

export function attachMediaTags(entries, records) {
  attachTextTags(entries, records, TAG, 'opfMedia', 'media');
}

function readTags(shape, relationships, entries) {
  const tags = [];
  let unreadable = false;
  for (const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
    const rel = relationships.get(link['r:id']);
    if (rel?.type !== REL || rel.targetMode === 'External' || !entries[rel.path]) { unreadable = true; continue; }
    try { tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])); } catch { unreadable = true; }
  }
  return {tags, unreadable};
}

const validAsset = (id, asset) => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id) && validatePresentation({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Media', assets: {[id]: asset}, slides: [{title: 'Media'}]}).valid;
const validVideo = value => validatePresentation({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'Media', slides: [{video: value}]}).valid;

/**
 * Returns {items, consumed, assets}. items are {shape, payload} for restored
 * video blocks (the frame supplies the position); consumed holds every shape
 * import must skip; assets are registry entries to add when absent.
 */
export function importMediaGroups(shapes, paragraphs, relationships, entries, slideIndex, report, registry = Object.create(null)) {
  const groups = new Map(), items = [], consumed = new Set(), assets = Object.create(null), captionShapes = new Set();
  for (const [index, shape] of shapes.entries()) {
    const {tags, unreadable} = readTags(shape, relationships, entries);
    const own = tags.filter(tag => String(tag.name ?? '').toUpperCase() === TAG);
    if (!own.length) continue;
    let record = null;
    try {
      if (unreadable || own.length !== 1 || tags.some(tag => /^OPF_/i.test(tag.name ?? '') && String(tag.name).toUpperCase() !== TAG)) throw Error('ambiguous');
      if (typeof own[0].val !== 'string' || own[0].val.length > MAX_VALUE_BYTES * 2) throw Error('oversized');
      record = decodeTextTag(own[0].val);
      if (!object(record) || record.v !== 1 || !ROLES.includes(record.role) || !mediaPath(record.path)) throw Error('invalid');
      const allowed = ['v', 'role', 'path', ...(record.role === 'frame' ? ['video', 'assets', 'omitted', 'nativeOnly'] : record.role === 'caption' ? ['line', 'count', 'boundary', 'fingerprint'] : [])];
      if (Object.keys(record).some(key => !allowed.includes(key))) throw Error('unknown field');
      if (record.role === 'caption' && (record.boundary !== undefined && !['hard', 'soft', 'end'].includes(record.boundary) || record.fingerprint !== undefined && (typeof record.fingerprint !== 'string' || !/^\d+:[0-9a-f]{16}$/.test(record.fingerprint)))) throw Error('invalid caption evidence');
      if (record.role === 'frame' && (record.omitted !== undefined && record.omitted !== true || record.nativeOnly !== undefined && record.nativeOnly !== true || (record.omitted || record.nativeOnly) && (Object.hasOwn(record, 'video') || Object.hasOwn(record, 'assets')) || record.omitted && record.nativeOnly)) throw Error('inconsistent frame');
    } catch { record = null; }
    const key = record?.path ?? `slides.${slideIndex}`;
    if (!groups.has(key)) groups.set(key, {path: key, members: [], invalid: false});
    const group = groups.get(key);
    if (!record) { group.invalid = true; group.members.push({index, shape, role: null}); continue; }
    if (record.role === 'caption') captionShapes.add(shape);
    group.members.push({index, shape, record, role: record.role});
  }
  for (const group of groups.values()) {
    const name = (member, suffix) => member.shape['p:nvSpPr']?.['p:cNvPr']?.name === `OPF media ${group.path} ${suffix}`;
    const text = member => (paragraphs[member.index] ?? []).map(paragraph => paragraph.text).join('\n');
    const byRole = role => group.members.filter(member => member.role === role);
    const [frame] = byRole('frame'), captions = byRole('caption').sort((a, b) => a.record.line - b.record.line);
    const decorations = group.members.filter(member => ['frame', 'badge', 'play'].includes(member.role));
    const path = currentPath(group.path, slideIndex);
    const caption = captions.map((member, index) => text(member) + (index === captions.length - 1 ? '' : member.record.boundary === 'hard' ? '\n' : ' ')).join('');
    const links = array(frame?.shape['p:nvSpPr']?.['p:cNvPr']?.['a:hlinkClick']);
    const rel = links.length === 1 ? relationships.get(links[0]['r:id']) : undefined;
    const href = rel?.type === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink' && rel.targetMode === 'External' ? webSource(rel.target) : null;
    let reason = null, video, restoredAssets;
    if (group.invalid) reason = 'a media tag is ambiguous or unreadable';
    else if (byRole('frame').length !== 1 || byRole('badge').length !== 1 || byRole('play').length !== 1 || !captions.length) reason = 'placeholder shapes were removed or duplicated';
    else if (!decorations.every(member => name(member, member.role) && !text(member)) || !captions.every(member => name(member, `caption line ${member.record.line}`))) reason = 'placeholder shapes were renamed or given text';
    else if (!captions.every((member, index) => member.record.line === index && member.record.count === captions.length)) reason = 'caption lines were removed or duplicated';
    else if (links.length && !href) reason = 'the native hyperlink is ambiguous or unsupported';
    else if (frame.record.nativeOnly === true) {
      if (!href) reason = 'no native web hyperlink is available';
      else video = caption === href ? href : {src: href, title: caption};
    }
    else if (frame.record.omitted || !Object.hasOwn(frame.record, 'video')) reason = 'the video value was omitted at export';
    else if (!validVideo(frame.record.video)) reason = 'the stored video value is not valid OPF';
    else if (hasData(frame.record.video) || hasData(frame.record.assets)) reason = 'the stored video contains an unsupported data: source';
    else if (frame.record.assets !== undefined && (!object(frame.record.assets) || !Object.entries(frame.record.assets).every(([id, asset]) => validAsset(id, asset)))) reason = 'the stored assets are not valid OPF';
    else {
      const source = resolvedSource(frame.record.video, frame.record.assets ?? {});
      const needed = new Set();
      let reference = sourceOf(frame.record.video);
      while (typeof reference === 'string' && reference.startsWith('asset:') && !needed.has(reference.slice(6))) {
        const id = reference.slice(6);
        needed.add(id);
        reference = sourceOf(frame.record.assets?.[id]);
      }
      if (Object.keys(frame.record.assets ?? {}).some(id => !needed.has(id))) reason = 'the stored assets contain unrelated entries';
      else if (source === undefined) reason = 'the stored asset reference cannot be resolved';
      else if (webSource(source) !== href) {
        if (!href) reason = 'its source hyperlink was removed';
        else {
          // Preserve the current URL and caption; hidden metadata describes the old source.
          video = caption === href ? href : {src: href, title: caption};
          report({code: 'media-source-changed', path, message: `The video hyperlink at ${path} changed; import keeps the current URL and caption.`});
        }
      }
      else if (!captions.every(member => typeof member.record.fingerprint === 'string' && mediaTextFingerprint(text(member)) === member.record.fingerprint)) reason = 'its caption text was edited or exact caption evidence is missing';
      // Exact line evidence detects native edits; this additional comparison
      // binds the stored authored title to visible words despite line wrapping.
      else if (visibleWords(caption) !== visibleWords(mediaCaption(frame.record.video))) reason = 'its stored caption disagrees with current native text';
      else if (!href && caption !== source) reason = 'its source has no current native hyperlink or source caption';
      else {
        const conflict = Object.entries(frame.record.assets ?? {}).some(([id, asset]) => Object.hasOwn(registry, id) && canonical(registry[id]) !== canonical(asset));
        if (conflict && !href) reason = 'its stored assets conflict with another video';
        else if (conflict) {
          video = caption === href ? href : {src: href, title: caption};
          report({code: 'media-asset-conflict', path, message: `Stored asset IDs at ${path} conflict with another video; import keeps this placeholder's current URL and caption.`});
        }
        else { video = structuredClone(frame.record.video); restoredAssets = frame.record.assets; }
      }
    }
    if (!reason) {
      for (const member of group.members) consumed.add(member.shape);
      items.push({shape: frame.shape, payload: {type: 'video', video}});
      if (object(restoredAssets)) for (const [id, asset] of Object.entries(restoredAssets)) {
        registry[id] = structuredClone(asset);
        assets[id] = structuredClone(asset);
      }
      continue;
    }
    // Tagged decoration carries no content; caption lines stay ordinary text.
    for (const member of group.members) if (member.role && member.role !== 'caption' && !text(member)) consumed.add(member.shape);
    // Preserve the current frame URL independently of failed tag evidence.
    // Decoration links never supply authority. Other schemes remain inert.
    if (rel?.type === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink' && rel.targetMode === 'External' && typeof rel.target === 'string') {
      items.push({shape: frame.shape, payload: {type: 'text', text: href ? [{text: href, link: href}] : rel.target}});
    }
    report({code: 'invalid-media-provenance', path,
      message: `The video placeholder at ${path} was not restored as a video because ${reason}. Its current caption stays as text and its current frame URL is retained as linked text when it is a web URL.`});
  }
  return {items, consumed, assets, captionShapes};
}
