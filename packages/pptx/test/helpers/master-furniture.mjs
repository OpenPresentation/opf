// RR-72: the furniture a slide shows. Parts drawn the same on several slides are written once on the slide master or a layout
// (src/master-furniture.js), so a test that reads one slide's furniture reads the slide, its layout and its master.
const dec = new TextDecoder();
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const text = (entries, path) => dec.decode(entries[path]);
const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');
function resolvePart(source, target) {
  const parts = source.split('/').slice(0, -1);
  for (const piece of target.split('/')) {
    if (piece === '..') parts.pop();
    else if (piece !== '.' && piece) parts.push(piece);
  }
  return parts.join('/');
}

/** The part a slide, layout or master relates to by type (`slideLayout`, `slideMaster`), or undefined. */
export function relatedPart(entries, path, type) {
  const rels = entries[relsOf(path)];
  if (!rels) return undefined;
  const node = [...text(entries, relsOf(path)).matchAll(/<Relationship\b[^>]*\/>/g)].map(match => match[0]).find(item => item.includes(`Type="${REL}/${type}"`));
  return node ? resolvePart(path, node.match(/\sTarget="([^"]*)"/)[1]) : undefined;
}

/** The layout and master paths of slide `number` (1-based). */
export function slideParts(entries, number) {
  const slide = `ppt/slides/slide${number}.xml`, layout = relatedPart(entries, slide, 'slideLayout');
  return {slide, layout, master: layout && relatedPart(entries, layout, 'slideMaster')};
}

const shapes = xml => [...xml.matchAll(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g)].map(match => match[0]);
const nameOf = shape => shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1];
const shown = attribute => attribute !== '0' && attribute !== 'false';

/**
 * Every furniture shape slide `number` shows, as [{on, xml, name}]: its own (`on: 'slide'`), then its layout's and its master's
 * lifted furniture (named `OPF furniture <kind> <zone> <field>[ line N]`), unless hidden by `showMasterSp="0"`.
 */
export function shownFurniture(entries, number) {
  const {slide, layout, master} = slideParts(entries, number);
  const slideXml = text(entries, slide), layoutXml = layout ? text(entries, layout) : '';
  const own = shapes(slideXml).filter(shape => /^OPF furniture /.test(nameOf(shape)) || (/^<p:pic>/.test(shape) && /rIdOpfFurniture/.test(shape)));
  const result = own.map(xml => ({on: 'slide', xml, name: nameOf(xml)}));
  const slideShows = shown(slideXml.match(/<p:sld\b[^>]*\bshowMasterSp="([^"]*)"/)?.[1]);
  const layoutShows = shown(layoutXml.match(/<p:sldLayout\b[^>]*\bshowMasterSp="([^"]*)"/)?.[1]);
  if (slideShows && layout) result.push(...lifted(layoutXml).map(xml => ({on: 'layout', xml, name: nameOf(xml)})));
  if (slideShows && layoutShows && master) result.push(...lifted(text(entries, master)).map(xml => ({on: 'master', xml, name: nameOf(xml)})));
  return result;
}

/** The lifted furniture shapes of a master or layout (not its placeholders). */
export const lifted = xml => shapes(xml).filter(shape => /^OPF furniture (?:header|footer) /.test(nameOf(shape)));

/** The shape of core part `part` (index `partIndex` on slide index `slideIndex`), line `line`, among `shapes` from shownFurniture. */
export function partLine(shapesShown, slideIndex, part, partIndex, line = 0) {
  const names = [`OPF furniture ${slideIndex} part ${partIndex} line ${line}`, `OPF furniture ${part.kind} ${part.zone} ${part.field} line ${line}`];
  return shapesShown.find(shape => names.includes(shape.name));
}

/** All the XML a slide shows furniture from: the slide, then its layout's and master's lifted shapes. */
export function shownXml(entries, number) {
  return [text(entries, `ppt/slides/slide${number}.xml`), ...shownFurniture(entries, number).filter(shape => shape.on !== 'slide').map(shape => shape.xml)].join('');
}

/** Apply `mutate` to the XML of every slide, layout and slide master (an edit wherever the furniture is drawn). */
export function editEverywhere(entries, mutate) {
  const enc = new TextEncoder();
  for (const path of Object.keys(entries)) if (/^ppt\/(?:slides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(path)) entries[path] = enc.encode(mutate(text(entries, path), path));
}

/** Each shape slide `number` shows (see shownFurniture) with the part it is drawn in (`path`), for resolving its relationships. */
export function shownFurnitureParts(entries, number) {
  const parts = slideParts(entries, number);
  return shownFurniture(entries, number).map(shape => ({...shape, path: parts[shape.on]}));
}

/** The package path a relationship id of `path` points at. */
export function relationshipPath(entries, path, id) {
  const node = [...text(entries, relsOf(path)).matchAll(/<Relationship\b[^>]*\/>/g)].map(match => match[0]).find(item => item.includes(`Id="${id}"`));
  return node ? resolvePart(path, node.match(/\sTarget="([^"]*)"/)[1]) : undefined;
}
