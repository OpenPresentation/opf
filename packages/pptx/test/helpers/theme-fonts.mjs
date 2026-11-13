// RR-105 (opf#1293): runs in their theme's heading or body family name the theme font (+mj-lt, +mn-ea, ...). Tests that read which
// family a part names resolve those references to the families of the part's theme, so they keep checking the family PowerPoint draws.
import {strFromU8} from 'fflate';

const text = value => typeof value === 'string' ? value : strFromU8(value);
const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');
const resolve = (from, target) => {
  const parts = from.split('/').slice(0, -1);
  for (const piece of target.split('/')) {
    if (piece === '..') parts.pop();
    else if (piece && piece !== '.') parts.push(piece);
  }
  return parts.join('/');
};
const targets = (entries, path, type) => !entries[relsOf(path)] ? [] : [...text(entries[relsOf(path)]).matchAll(/<Relationship\b[^>]*>/g)].map(([node]) => node)
  .filter(node => new RegExp(`\\bType="[^"]*/${type}"`).test(node) && !/TargetMode="External"/.test(node)).map(node => resolve(path, /\bTarget="([^"]*)"/.exec(node)[1]));

/** The theme part a package part draws with: a slide's (through its layout and master), else the slide that holds the part, else theme1. */
export function themeOf(entries, path) {
  const slideTheme = slide => {
    const master = targets(entries, targets(entries, slide, 'slideLayout')[0] ?? '', 'slideMaster')[0];
    return master && targets(entries, master, 'theme')[0];
  };
  if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) return slideTheme(path) ?? 'ppt/theme/theme1.xml';
  const owner = Object.keys(entries).find(slide => /^ppt\/slides\/slide\d+\.xml$/.test(slide) && Object.values(['chart', 'chartEx', 'diagramData', 'diagramDrawing']).some(type => targets(entries, slide, type).includes(path)));
  return (owner && slideTheme(owner)) ?? 'ppt/theme/theme1.xml';
}

/** The theme's typefaces by reference: {'+mj-lt': family, '+mn-ea': family, ...}; an empty slot is left out. */
export function themeReferences(entries, themePath) {
  const xml = entries[themePath] ? text(entries[themePath]) : '';
  const references = {};
  for (const [key, tag] of [['mj', 'majorFont'], ['mn', 'minorFont']]) {
    const block = new RegExp(`<a:${tag}>([\\s\\S]*?)</a:${tag}>`).exec(xml)?.[1] ?? '';
    for (const [element, slot] of [['latin', 'lt'], ['ea', 'ea'], ['cs', 'cs']]) {
      const face = new RegExp(`<a:${element}\\b[^>]*?\\btypeface="([^"]*)"`).exec(block)?.[1];
      if (face) references[`+${key}-${slot}`] = face;
    }
  }
  return references;
}

/** A part's XML with every theme font reference replaced by its theme's family (attributes as written). */
export function withThemeFamilies(entries, path, xml = text(entries[path])) {
  const references = themeReferences(entries, themeOf(entries, path));
  return xml.replace(/\btypeface="(\+m[jn]-(?:lt|ea|cs))"/g, (node, reference) => references[reference] !== undefined ? `typeface="${references[reference]}"` : node);
}
