import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag} from './code-provenance.js';

// Embeds (OPF `embed`, FR-08): a live web page that a web presenter may show and every other output draws as a picture linked to it.
//
// PowerPoint has no live page, so an embed exports as its static form, linked to `src` (a:hlinkClick):
// - With a `preview` picture: one native picture, `OPF embed <path>`, contained in the embed's frame on the scheme's surface color (the
//   picture's own fill), its description the embed's title.
// - Without one (or when it cannot be embedded): the card, a rounded panel `OPF embed <path>` with a link badge (an ellipse and an arrow,
//   `... badge`, `... arrow`) and the title and site name as text lines (`... title line N`, `... site line 0`), written as one native
//   group `OPF embed <path> group` whose description is the title. Every part links to `src`.
//
// In `full` provenance the picture or the panel carries OPF_EMBED_V1: {v, path, embed ({src, title?, aspectRatio?}: the authored value
// without its `preview`), written (the title the object was written with), preview? (the authored preview source when it is a relative
// path or a web address; otherwise the imported picture is the preview), evidence ({href: src, media?: the key of the picture's media,
// text?: the card's title lines})}. The 0.36.0 importer ignores the tag (a tag it does not know is skipped) and reads the object as an
// ordinary linked picture, or as shapes and linked text, so the file is a valid deck there.
//
// Import restores the embed only while its evidence holds: the object's link still equals `src` and, for a picture, its bytes are the
// ones that were exported (the media key), for a card, its title text is the one written. A replaced picture, a changed link or an
// edited title imports as what is there and reports `embed-provenance-changed`.
export const EMBED_TAG = 'OPF_EMBED_V1';
export const embedName = path => `OPF embed ${path}`;
export const embedGroupName = path => `${embedName(path)} group`;
const NAME = /^OPF embed (slides\.\d+(?:\.[A-Za-z0-9_:+-]{1,64}){1,32})$/;
const GROUP = /^OPF embed (slides\.\d+(?:\.[A-Za-z0-9_:+-]{1,64}){1,32}) group$/;
const BLOCK_PATH = /^slides\.\d+(?:\.[A-Za-z0-9_:+-]{1,64}){1,32}$/;
const HYPERLINK = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const decoder = new TextDecoder('utf-8', {fatal: true});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const scalar = value => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

/** Whether a shape name is a part of the card of `panel` (its badge, arrow, title and site lines). */
export const isEmbedCardPart = (panel, name) => typeof name === 'string' && name.startsWith(`${panel} `) && /^(?:badge|arrow|(?:title|site) line \d+)$/.test(name.slice(panel.length + 1));

/**
 * Tag the generated embed pictures and card panels of a package. `records`: Map<object name, {v, path, embed, written, preview?,
 * evidence}>; a picture's evidence gets the media key of its bytes (`mediaKeyFor(part, relationship id)`).
 */
export function tagEmbeds(entries, records, {relationshipsOf, mediaKeyFor}) {
  if (!records.size) return;
  const manifests = new Map();
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort()) {
    const xml = decoder.decode(entries[part]);
    for (const [shape, kind] of xml.matchAll(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g)) {
      const name = /<p:cNvPr\b[^>]*\bname="([^"]+)"/.exec(shape)?.[1], record = records.get(name);
      if (!record) continue;
      if (kind === 'pic') {
        const id = /<a:blip\b[^>]*r:embed="([^"]+)"/.exec(shape)?.[1], media = id === undefined ? undefined : mediaKeyFor(part, id);
        if (media === undefined) throw new Error('A generated embed picture has no media part.');
        manifests.set(name, {...record, evidence: {...record.evidence, media}});
      } else manifests.set(name, record);
    }
  }
  if (manifests.size !== records.size) throw new Error('Missing generated embed shapes.');
  attachTextTags(entries, manifests, EMBED_TAG, 'opfEmbed', 'embed', {pictures: true});
}

/**
 * The card's shapes (the panel and the parts that follow it, written consecutively) become one p:grpSp named "<panel> group" with the
 * title as its description (CT_GroupShape: nvGrpSpPr, grpSpPr, members). Its transform is the identity (chOff/chExt equal off/ext, the
 * members' union), so every member keeps its box and stays an editable shape; names and tags stay on the members.
 */
export function groupEmbedCards(xml, panels, description) {
  if (!panels.size) return xml;
  let next = Math.max(0, ...[...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1]))) + 1;
  const nameOf = shape => shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '';
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>(?:<p:sp>[\s\S]*?<\/p:sp>)*/g, run => {
    const shapes = run.match(/<p:sp>[\s\S]*?<\/p:sp>/g);
    let out = '';
    for (let index = 0; index < shapes.length; index++) {
      const panel = nameOf(shapes[index]);
      if (!panels.has(panel)) { out += shapes[index]; continue; }
      const members = [shapes[index]];
      while (index + 1 < shapes.length && isEmbedCardPart(panel, nameOf(shapes[index + 1]))) members.push(shapes[++index]);
      const boxes = members.map(shape => shape.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/)).filter(Boolean).map(match => match.slice(1).map(Number));
      if (!boxes.length) { out += members.join(''); continue; }
      const x = Math.min(...boxes.map(box => box[0])), y = Math.min(...boxes.map(box => box[1]));
      const cx = Math.max(...boxes.map(box => box[0] + box[2])) - x, cy = Math.max(...boxes.map(box => box[1] + box[3])) - y;
      out += `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${next++}" name="${panel} group" descr="${description(panel)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
        + `<p:grpSpPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/><a:chOff x="${x}" y="${y}"/><a:chExt cx="${cx}" cy="${cy}"/></a:xfrm></p:grpSpPr>${members.join('')}</p:grpSp>`;
    }
    return out;
  });
}

/** Whether a native group is an exported embed card group with an identity transform (its children keep their boxes). */
export function isEmbedCardGroup(group) {
  if (!GROUP.test(String(group?.['p:nvGrpSpPr']?.['p:cNvPr']?.name ?? ''))) return false;
  const xfrm = group?.['p:grpSpPr']?.['a:xfrm'];
  return ['x', 'y'].every(key => String(xfrm?.['a:off']?.[key]) === String(xfrm?.['a:chOff']?.[key]))
    && ['cx', 'cy'].every(key => String(xfrm?.['a:ext']?.[key]) === String(xfrm?.['a:chExt']?.[key]));
}

// The one OPF_EMBED_V1 tag of a shape, decoded, or null (absent); throws when it is unreadable, repeated or beside another OPF tag.
function ownTag(container, relationships, entries) {
  const tags = [];
  let unreadable = false;
  for (const link of array(container?.['p:tags'])) {
    const rel = relationships.get(link['r:id']);
    if (rel?.type !== REL || rel.targetMode === 'External' || !entries[rel.path]) { unreadable = true; continue; }
    try { tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])); } catch { unreadable = true; }
  }
  const own = tags.filter(tag => String(tag.name ?? '').toUpperCase() === EMBED_TAG);
  if (!own.length) return null;
  if (unreadable || own.length !== 1 || tags.some(tag => /^OPF_/i.test(String(tag.name ?? '')) && String(tag.name).toUpperCase() !== EMBED_TAG)) throw Error('Ambiguous embed identity.');
  return decodeTextTag(own[0].val);
}

// The external web address an object's click link names, or undefined (no link, an internal link, or several).
function hrefOf(properties, relationships) {
  const links = array(properties?.['a:hlinkClick']);
  if (links.length !== 1) return undefined;
  const rel = relationships.get(links[0]['r:id']);
  return rel?.type === HYPERLINK && rel.targetMode === 'External' && typeof rel.target === 'string' ? rel.target : undefined;
}

const validManifest = manifest => manifest?.v === 1 && typeof manifest.path === 'string' && BLOCK_PATH.test(manifest.path) && object(manifest.embed)
  && typeof manifest.embed.src === 'string' && Object.keys(manifest.embed).every(key => ['src', 'title', 'aspectRatio'].includes(key))
  && typeof manifest.written === 'string' && object(manifest.evidence) && manifest.evidence.href === manifest.embed.src
  && (manifest.preview === undefined || typeof manifest.preview === 'string');

// The embed block of a manifest: the string shorthand when it holds nothing but the address.
function payloadOf(manifest, title, preview) {
  const value = {src: manifest.embed.src, ...(title !== undefined ? {title} : {}), ...(manifest.embed.aspectRatio !== undefined ? {aspectRatio: manifest.embed.aspectRatio} : {}), ...(preview !== undefined ? {preview} : {})};
  return {type: 'embed', embed: Object.keys(value).length === 1 ? value.src : value};
}

/**
 * Recover the embed blocks of one slide. `pictures` and `shapes` are the slide's native pictures and text shapes (nativePictures and
 * nativeTextShapes order), `paragraphs` the shapes' paragraphs; `mediaKeyOf(picture)` is the key of a picture's bytes, `readPicture(picture)`
 * the ordinary imported image payload, `valid(payload)` checks a recovered block against the OPF format.
 * Returns {pictures: Map<index, payload>, cards: [{panel (shape index), members (shape indexes), payload}]}.
 */
export function importEmbeds({pictures, shapes, paragraphs, relationships, entries, slideIndex, mediaKeyOf, readPicture, valid, report}) {
  const slide = `slides.${slideIndex}`, found = {pictures: new Map(), cards: []};
  const changed = (path, message) => report({code: 'embed-provenance-changed', path: path ?? slide, message});
  const names = shapes.map(shape => scalar(shape?.['p:nvSpPr']?.['p:cNvPr']?.name));
  for (const [index, picture] of pictures.entries()) {
    let manifest;
    try { manifest = ownTag(picture?.['p:nvPicPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries); }
    catch { changed(slide, 'A tagged OPF embed picture is ambiguous; it was imported as an ordinary picture.'); continue; }
    if (manifest === null) continue;
    const properties = picture?.['p:nvPicPr']?.['p:cNvPr'];
    const reason = !validManifest(manifest) ? 'its record is not valid'
      : scalar(properties?.name) !== embedName(manifest.path) ? 'it was renamed'
        : typeof manifest.evidence.media !== 'string' || mediaKeyOf(picture) !== manifest.evidence.media ? 'its picture was replaced'
          : hrefOf(properties, relationships) !== manifest.embed.src ? 'its link no longer opens the embed\'s address' : undefined;
    if (reason) { changed(manifest?.path, `An OPF embed picture was imported as an ordinary picture because ${reason}; the embed is not restored.`); continue; }
    const current = scalar(properties?.descr);
    const title = current === manifest.written ? manifest.embed.title : current !== '' ? current : manifest.embed.title;
    const imported = readPicture(picture);
    const preview = manifest.preview ?? imported?.payload?.image?.src;
    if (typeof preview !== 'string') { changed(manifest.path, 'An OPF embed picture has no readable picture to restore as its preview; it was imported as an ordinary picture.'); continue; }
    const payload = payloadOf(manifest, title, preview);
    if (!valid(payload)) { changed(manifest.path, 'A tagged OPF embed picture does not form a valid embed block; it was imported as an ordinary picture.'); continue; }
    found.pictures.set(index, payload);
  }
  for (const [index, shape] of shapes.entries()) {
    let manifest;
    try { manifest = ownTag(shape?.['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst'], relationships, entries); }
    catch { changed(slide, 'A tagged OPF embed card is ambiguous; its shapes were imported as ordinary content.'); continue; }
    if (manifest === null) continue;
    const name = names[index], members = [index, ...names.flatMap((other, position) => position !== index && isEmbedCardPart(name, other) ? [position] : [])];
    const lines = members.filter(member => member !== index && /^title line \d+$/.test(names[member].slice(name.length + 1)))
      .sort((a, b) => Number(names[a].slice(names[a].lastIndexOf(' ') + 1)) - Number(names[b].slice(names[b].lastIndexOf(' ') + 1)))
      .map(member => (paragraphs[member] ?? []).map(paragraph => paragraph.text).join('\n')).join('\n');
    const reason = !validManifest(manifest) ? 'its record is not valid'
      : name !== embedName(manifest.path) ? 'it was renamed'
        : hrefOf(shape?.['p:nvSpPr']?.['p:cNvPr'], relationships) !== manifest.embed.src ? 'its link no longer opens the embed\'s address'
          : typeof manifest.evidence.text !== 'string' || lines !== manifest.evidence.text ? 'its title text was edited' : undefined;
    if (reason) { changed(manifest?.path, `An OPF embed card was imported as ordinary shapes because ${reason}; the embed is not restored.`); continue; }
    const payload = payloadOf(manifest, manifest.embed.title, undefined);
    if (!valid(payload)) { changed(manifest.path, 'A tagged OPF embed card does not form a valid embed block; its shapes were imported as ordinary content.'); continue; }
    found.cards.push({panel: index, members, payload});
  }
  return found;
}
