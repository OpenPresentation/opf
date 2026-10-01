// Native SVG pictures (PowerPoint 2016 and Microsoft 365): a `p:pic` whose `a:blip` embeds a PNG fallback raster and
// carries the `asvg:svgBlip` extension that points at the SVG media part. This module holds the parts that need no
// I/O: reading an SVG data URI, validating and sanitizing the XML (nothing executes, nothing is fetched), measuring
// the intrinsic size, choosing the fallback raster size and writing the extension into a generated package.

export const SVG_BLIP_URI = '{96DAC541-7B7A-43D3-8B79-37D633B846F1}';
export const SVG_BLIP_NS = 'http://schemas.microsoft.com/office/drawing/2016/SVG/main';
const SVG_NS = 'http://www.w3.org/2000/svg';
const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const MAX_SVG_BYTES = 8 * 1024 * 1024;
// The fallback raster: 192 dpi at the displayed size, rounded up to a multiple of 128 px, never beyond 2304 px.
const RASTER_DPI = 192, RASTER_STEP = 128, RASTER_MIN = 128, RASTER_MAX = 2304;

const decoder = new TextDecoder('utf-8', {fatal: true}), encoder = new TextEncoder();

// Elements that can run code or load a document; they are removed with their content.
const REMOVED_ELEMENTS = new Set(['script', 'foreignObject', 'handler', 'listener']);
// Raster images a nested `href` / `url()` may carry inline; every other reference is external or executable.
const INLINE_RASTER = /^data:image\/(?:png|jpe?g|gif|webp)[;,]/i;

class SvgError extends Error {
  constructor(reason, message) { super(message); this.reason = reason; }
}

/**
 * The bytes of a `data:` URI whose media type is an SVG, or null when the URI is not an SVG (a raster, any other type,
 * or not a data URI). Base64 and percent-encoded text payloads are read; `{error}` marks a payload that is not decodable.
 */
export function svgDataUriBytes(uri) {
  const match = /^data:([^;,]*)((?:;[^;,]*)*),/i.exec(uri);
  if (!match || !/^image\/svg/i.test(match[1])) return null;
  const payload = uri.slice(match[0].length);
  try {
    if (/;base64/i.test(match[2])) {
      const binary = atob(payload.replace(/\s+/g, ''));
      return Uint8Array.from(binary, char => char.charCodeAt(0));
    }
    return encoder.encode(decodeURIComponent(payload));
  } catch {
    return {error: 'The SVG data URI payload is not valid base64 or percent-encoded text.'};
  }
}

export function svgDataUri(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

function decodeText(bytes) {
  let start = 0, label = 'utf-8';
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) label = 'utf-16le', start = 2;
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) label = 'utf-16be', start = 2;
  else {
    const declared = /^\s*<\?xml\b[^>]*\bencoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(String.fromCharCode(...bytes.subarray(0, 200)))?.[1];
    if (declared && !/^utf-?8$/i.test(declared)) label = declared;
  }
  try {
    return new TextDecoder(label, {fatal: true}).decode(bytes.subarray(start));
  } catch {
    throw new SvgError('svg-malformed', `The SVG text is not valid ${label}.`);
  }
}

const number = value => {
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|q)?\s*$/i.exec(value ?? '');
  if (!match) return null;
  const unit = {px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, q: 96 / 101.6}[(match[2] ?? 'px').toLowerCase()];
  const result = Number(match[1]) * unit;
  return Number.isFinite(result) && result > 0 ? result : null;
};

/**
 * Intrinsic size in CSS pixels from the root's width, height and viewBox, following the SVG rules a browser
 * uses for an image: both lengths absolute; one absolute and a viewBox (the other follows its ratio); a viewBox alone.
 * Percentage, relative and missing lengths without a viewBox have no size.
 */
export function svgIntrinsicSize(attributes) {
  const width = number(attributes.width), height = number(attributes.height);
  const box = (attributes.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const view = box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0 ? {width: box[2], height: box[3]} : null;
  let size = null;
  if (width && height) size = {width, height};
  else if (view && width) size = {width, height: width * view.height / view.width};
  else if (view && height) size = {width: height * view.width / view.height, height};
  else if (view) size = view;
  return size && size.width <= 1e7 && size.height <= 1e7 && size.width / size.height <= 1e4 && size.height / size.width <= 1e4 ? size : null;
}

const filterUrls = value => value.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi, (reference, double, single, bare) => {
  const target = (double ?? single ?? bare ?? '').trim();
  return target.startsWith('#') || INLINE_RASTER.test(target) ? reference : 'none';
});
const filterCss = value => filterUrls(value.replace(/@import\b[^;{}]*(?:;|$)/gi, ''));

const START_TAG = /<([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)((?:\s+[^\s=\/>"'<]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/y;
const ATTRIBUTE = /\s+([^\s=\/>"'<]+)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/y;
const END_TAG = /<\/([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)\s*>/y;
const escapeAttribute = value => value.replace(/"/g, '&quot;');

function parseAttributes(source) {
  const result = [], names = new Set();
  ATTRIBUTE.lastIndex = 0;
  for (let match; source && (match = ATTRIBUTE.exec(source));) {
    if (names.has(match[1])) throw new SvgError('svg-malformed', `The SVG repeats the attribute ${match[1]}.`);
    names.add(match[1]);
    result.push([match[1], match[2] ?? match[3]]);
  }
  return result;
}

/**
 * Validate and sanitize an SVG. A well-formed document with an SVG root, an `xmlns` and an intrinsic size passes;
 * scripts, `foreignObject`, event handlers, animations of links, every reference that is not a fragment (`#id`) or an
 * inline raster, `@import` rules, `xml-stylesheet` instructions and DOCTYPE declarations are removed (entities a
 * DOCTYPE declares as plain text are expanded; external entities are refused). Nothing is fetched or executed.
 * Returns `{bytes, text, hasText, width, height, removed}`: `bytes` are the original bytes when nothing had to be removed,
 * otherwise the sanitized document encoded as UTF-8; `text` is the sanitized document (what is drawn). `{error: {reason, message}}` for a document that cannot be exported.
 */
export function prepareSvg(input) {
  try {
    if (!(input instanceof Uint8Array)) throw new SvgError('svg-malformed', 'The SVG source is not text.');
    if (input.byteLength > MAX_SVG_BYTES) throw new SvgError('svg-too-large', `The SVG is larger than ${MAX_SVG_BYTES / 1024 / 1024} MiB.`);
    return sanitize(input, decodeText(input));
  } catch (error) {
    if (error instanceof SvgError) return {error: {reason: error.reason, message: error.message}};
    throw error;
  }
}

function sanitize(input, text) {
  const out = [], stack = [], entities = new Map(), removed = new Set();
  let index = 0, root = null, skipping = 0, expansion = 0, hasText = false;
  const malformed = message => { throw new SvgError('svg-malformed', `The SVG is not well-formed XML: ${message}`); };
  // Entity and character references in text and attribute values: only the five predefined entities, numeric
  // references and plain-text entities the DOCTYPE declared; anything else is not well-formed XML.
  const references = value => value.replace(/&([^;\s&<]*);?/g, (all, name) => {
    if (!all.endsWith(';')) malformed('an ampersand starts no reference');
    if (/^(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6})$/.test(name)) return all;
    if (!entities.has(name)) malformed(`the entity &${name}; is not declared`);
    const expanded = entities.get(name);
    if ((expansion += expanded.length) > MAX_SVG_BYTES) throw new SvgError('svg-unsafe', 'The SVG expands its entities beyond the size limit.');
    return expanded;
  });

  while (index < text.length) {
    if (text[index] !== '<') {
      const end = text.indexOf('<', index), chunk = text.slice(index, end < 0 ? text.length : end);
      index += chunk.length;
      if (!stack.length) {
        if (chunk.trim()) malformed('text outside the root element');
      } else if (!skipping) {
        if (chunk.includes(']]>')) malformed('a stray CDATA terminator');
        const style = stack.at(-1).name === 'style';
        out.push(references(style ? filterCss(chunk) : chunk));
      }
      continue;
    }
    if (text.startsWith('<!--', index)) {
      const end = text.indexOf('-->', index + 4);
      if (end < 0) malformed('an unterminated comment');
      index = end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', index)) {
      const end = text.indexOf(']]>', index + 9);
      if (end < 0) malformed('an unterminated CDATA section');
      if (!stack.length) malformed('CDATA outside the root element');
      if (!skipping) out.push(`<![CDATA[${stack.at(-1).name === 'style' ? filterCss(text.slice(index + 9, end)) : text.slice(index + 9, end)}]]>`);
      index = end + 3;
      continue;
    }
    if (text.startsWith('<?', index)) {
      const end = text.indexOf('?>', index + 2);
      if (end < 0) malformed('an unterminated processing instruction');
      if (!/^<\?xml[\s?]/i.test(text.slice(index, index + 6)) && /^<\?xml-stylesheet\b/i.test(text.slice(index, index + 20))) removed.add('a stylesheet instruction');
      index = end + 2;
      continue;
    }
    if (text.startsWith('<!DOCTYPE', index)) {
      if (root || stack.length) malformed('a DOCTYPE after the root element');
      const match = /^<!DOCTYPE\s+[^\[>]*(?:\[([\s\S]*?)\]\s*)?>/.exec(text.slice(index));
      if (!match) malformed('an unreadable DOCTYPE');
      for (const declaration of (match[1] ?? '').matchAll(/<!ENTITY\b[^>]*>/g)) {
        const entity = /^<!ENTITY\s+([A-Za-z_][\w.-]*)\s+(?:"([^"]*)"|'([^']*)')\s*>$/.exec(declaration[0]);
        const value = entity?.[2] ?? entity?.[3];
        if (!entity || value.includes('&') || value.includes('<')) throw new SvgError('svg-unsafe', 'The SVG declares an external or markup entity, which is not read.');
        entities.set(entity[1], value);
      }
      removed.add('a DOCTYPE declaration');
      index += match[0].length;
      continue;
    }
    if (text.startsWith('</', index)) {
      END_TAG.lastIndex = index;
      const match = END_TAG.exec(text);
      if (!match) malformed('an unreadable closing tag');
      const open = stack.pop();
      if (!open || open.qualified !== match[1]) malformed(`</${match[1]}> does not close <${open?.qualified ?? 'nothing'}>`);
      index = END_TAG.lastIndex;
      if (open.skip) skipping--;
      else out.push(`</${match[1]}>`);
      if (!stack.length) root = root ?? true;
      continue;
    }
    START_TAG.lastIndex = index;
    const match = START_TAG.exec(text);
    if (!match) malformed('an unreadable tag');
    index = START_TAG.lastIndex;
    const [, qualified, source, selfClosing] = match, name = qualified.slice(qualified.indexOf(':') + 1);
    const attributes = parseAttributes(source);
    if (!stack.length) {
      if (root) malformed('more than one root element');
      if (name !== 'svg') throw new SvgError('svg-malformed', `The root element is <${qualified}>, not <svg>.`);
      const prefix = qualified.includes(':') ? `xmlns:${qualified.slice(0, qualified.indexOf(':'))}` : 'xmlns';
      if (!attributes.some(([key, value]) => key === prefix && references(value) === SVG_NS)) throw new SvgError('svg-malformed', `The root <svg> has no ${prefix}="${SVG_NS}".`);
      root = {attributes: Object.fromEntries(attributes.map(([key, value]) => [key, references(value)]))};
    }
    const drop = skipping > 0 || REMOVED_ELEMENTS.has(name)
      || (['animate', 'set'].includes(name) && attributes.some(([key, value]) => key === 'attributeName' && /(?:^|:)href$/i.test(value)));
    if (!skipping && drop) removed.add(name === 'script' ? 'scripts' : `<${name}> elements`);
    if (!drop) {
      if (name === 'text') hasText = true;
      let tag = `<${qualified}`;
      for (const [key, raw] of attributes) {
        const local = key.slice(key.indexOf(':') + 1);
        let value = references(raw);
        if (/^on/i.test(local)) { removed.add('event handlers'); continue; }
        if (key === 'xml:base') { removed.add('external references'); continue; }
        if (/^href$/i.test(local)) {
          if (!(value.trim().startsWith('#') || INLINE_RASTER.test(value.trim()))) { removed.add('external references'); continue; }
        } else if (/url\(/i.test(value) || key === 'style') {
          const filtered = key === 'style' ? filterCss(value) : filterUrls(value);
          if (filtered !== value) removed.add('external references');
          value = filtered;
        }
        tag += ` ${key}="${escapeAttribute(value)}"`;
      }
      out.push(selfClosing ? `${tag}/>` : `${tag}>`);
    }
    if (!selfClosing) {
      stack.push({qualified, name, skip: drop});
      if (drop) skipping++;
    } else if (!stack.length) root = root ?? true;
  }
  if (stack.length) malformed(`<${stack.at(-1).qualified}> is never closed`);
  if (!root) malformed('there is no root element');
  const size = svgIntrinsicSize(root.attributes);
  if (!size) throw new SvgError('svg-no-size', 'The SVG has no width and height, and no viewBox, so it has no intrinsic size.');
  const list = [...removed], clean = out.join('');
  return {bytes: list.length || entities.size ? encoder.encode(clean) : input, text: clean, hasText, width: size.width, height: size.height, removed: list};
}

/**
 * The fallback raster's size: the SVG's own aspect, at 192 dpi of the displayed size (the SVG contained in `box`, or
 * covering it when `cover`), rounded up to a multiple of 128 px (so equal pictures of different box sizes often share one
 * raster), within 128 to 2304 px on the long side. `box` is in inches; without it the SVG's own CSS size is used.
 */
export function svgRasterScale(size, box, cover = false) {
  const covered = box ? (cover ? Math.max : Math.min)(box.w / size.width, box.h / size.height) * 96 : 1;
  const long = Math.max(size.width, size.height) * covered * RASTER_DPI / 96;
  const target = Math.min(RASTER_MAX, Math.max(RASTER_MIN, Math.ceil(long / RASTER_STEP) * RASTER_STEP));
  return target / Math.max(size.width, size.height);
}

const tagAttributes = tag => Object.fromEntries([...tag.matchAll(/\s([^\s=/>]+)\s*=\s*"([^"]*)"/g)].map(match => [match[1], match[2]]));

/**
 * The relationship id of a picture blip's SVG, from its parsed XML (`a:blip` node), or undefined.
 */
export function svgBlipRelationship(blip) {
  const extensions = blip?.['a:extLst']?.['a:ext'];
  for (const extension of Array.isArray(extensions) ? extensions : extensions ? [extensions] : []) {
    if (String(extension?.uri ?? '').toUpperCase() === SVG_BLIP_URI) {
      const embed = extension['asvg:svgBlip']?.['r:embed'];
      if (typeof embed === 'string' && embed) return embed;
    }
  }
  return undefined;
}

/**
 * A parsed `a:blip` without its SVG extension: the identity a provenance manifest compares. Whether a picture
 * carries an SVG is read from the package itself (the part may be rewritten by PowerPoint), not from the manifest.
 */
export function withoutSvgBlip(blip) {
  const extensions = blip?.['a:extLst']?.['a:ext'];
  if (!extensions) return blip;
  const kept = (Array.isArray(extensions) ? extensions : [extensions]).filter(extension => String(extension?.uri ?? '').toUpperCase() !== SVG_BLIP_URI);
  const {['a:extLst']: _extensions, ...rest} = blip;
  return kept.length ? {...rest, 'a:extLst': {...blip['a:extLst'], 'a:ext': kept.length === 1 ? kept[0] : kept}} : rest;
}

/**
 * A parsed `p:blipFill` (or a stored identity of one) with its crop in canonical form: PowerPoint drops the zero sides of an
 * `a:srcRect` when it saves (`l="25000" t="0" r="25000" b="0"` becomes `l="25000" r="25000"`), and an all-zero crop is no crop.
 */
export function normalizeCrop(blipFill) {
  const crop = blipFill?.['a:srcRect'];
  if (!blipFill || typeof crop !== 'object' || crop === null) return blipFill;
  const kept = Object.fromEntries(Object.entries(crop).filter(([, value]) => !(Number(value) === 0)));
  const {['a:srcRect']: _crop, ...rest} = blipFill;
  return Object.keys(kept).length ? {...rest, 'a:srcRect': kept} : rest;
}

/**
 * Add the SVG pictures to a generated package. `pictures` maps a picture's shape name (or `slidePart|name` for names
 * a slide repeats) to `{bytes, width, height}`. For each matching `p:pic` this writes the SVG as a media part, a
 * relationship from the slide, and `a:extLst/a:ext/asvg:svgBlip` inside the picture's `a:blip` (after any effect
 * children, as the schema orders them); the PNG the blip already embeds stays the fallback.
 * Returns Map<fallback media part, {width, height}> so fitting can use the SVG's own proportions.
 */
export function attachSvgPictures(entries, pictures) {
  const sizes = new Map();
  if (!pictures.size) return sizes;
  const read = path => new TextDecoder().decode(entries[path]), write = (path, xml) => { entries[path] = encoder.encode(xml); };
  let media = 0, needsType = false;
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort()) {
    const relationshipPart = part.replace('/slides/', '/slides/_rels/') + '.rels';
    let relationships = read(relationshipPart);
    const targets = new Map([...relationships.matchAll(/<Relationship\b[^>]*>/g)].map(match => {
      const attributes = tagAttributes(match[0]);
      return [attributes.Id, attributes.Target];
    }));
    let changed = false;
    const xml = read(part).replace(/<p:pic>[\s\S]*?<\/p:pic>/g, picture => {
      const name = /<p:cNvPr\b[^>]*\bname="([^"]*)"/.exec(picture)?.[1];
      const svg = pictures.get(`${part}|${name}`) ?? pictures.get(name);
      if (!svg) return picture;
      const blip = /<a:blip\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:blip>)/.exec(picture);
      const fallback = /\br:embed="([^"]+)"/.exec(blip?.[1] ?? '')?.[1];
      if (!blip || !fallback || (blip[2] ?? '').includes('a:extLst')) throw new Error('A generated picture has no plain fallback blip for its SVG.');
      let path;
      do path = `ppt/media/svg-${/\d+/.exec(part)[0]}-${++media}.svg`; while (entries[path]);
      entries[path] = svg.bytes;
      const taken = new Set([...relationships.matchAll(/\bId="([^"]+)"/g)].map(match => match[1]));
      let id = `rIdOpfSvg${media}`;
      while (taken.has(id)) id += '_';
      relationships = relationships.replace('</Relationships>', `<Relationship Id="${id}" Type="${IMAGE_REL}" Target="../media/${path.slice('ppt/media/'.length)}"/></Relationships>`);
      const fallbackPart = targets.get(fallback)?.replace(/^\.\.\//, 'ppt/');
      if (fallbackPart) sizes.set(fallbackPart, {width: svg.width, height: svg.height});
      changed = needsType = true;
      const extension = `<a:extLst><a:ext uri="${SVG_BLIP_URI}"><asvg:svgBlip xmlns:asvg="${SVG_BLIP_NS}" r:embed="${id}"/></a:ext></a:extLst>`;
      return picture.replace(blip[0], () => `<a:blip${blip[1]}>${blip[2] ?? ''}${extension}</a:blip>`);
    });
    if (changed) { write(part, xml); write(relationshipPart, relationships); }
  }
  if (needsType) {
    const types = read('[Content_Types].xml');
    if (!/<Default\b[^>]*\bExtension="svg"/i.test(types)) write('[Content_Types].xml', types.replace('</Types>', '<Default Extension="svg" ContentType="image/svg+xml"/></Types>'));
  }
  return sizes;
}
