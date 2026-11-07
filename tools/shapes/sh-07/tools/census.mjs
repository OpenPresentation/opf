// node census.mjs [family]: the SVG vocabulary pele draws for each corpus source: elements, attributes, classes, defs and transforms.
import { readFileSync } from 'node:fs';
import { layoutDiagram } from 'file:///C:/opf-work/sh-07-native-diagrams/packages/javascript/dist/composition.js';
const measure = (text, size, style) => Array.from(text).length * size * (style.mono ? .6 : style.bold ? .58 : .52);
const corpus = readFileSync('C:/opf-work/shapes/sh-07/sources/corpus.txt', 'utf8').split(/^=== /m).filter(Boolean).map((part) => {
  const nl = part.indexOf('\n');
  return { id: part.slice(0, nl).trim(), source: part.slice(nl + 1).replace(/\s+$/, '') };
});
const only = process.argv[2];
const families = new Map();
for (const { id, source } of corpus) {
  const family = id.replace(/-[a-z]$/, '');
  if (only && family !== only) continue;
  const d = layoutDiagram(source, { width: 1100, height: 560, nominal: 32, floor: 16, measure, idPrefix: 'd' });
  const f = families.get(family) ?? { tags: new Map(), attrs: new Set(), classes: new Set(), transforms: new Set(), styles: new Set() };
  families.set(family, f);
  for (const [, tag, attrs] of d.svg.matchAll(/<([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g)) {
    f.tags.set(tag, (f.tags.get(tag) ?? 0) + 1);
    for (const [, name, value] of attrs.matchAll(/\s+([\w:-]+)="([^"]*)"/g)) {
      f.attrs.add(`${tag}.${name}`);
      if (name === 'class') for (const c of value.split(/\s+/)) f.classes.add(c);
      if (name === 'transform') f.transforms.add(value.replace(/[-\d.]+/g, '#'));
      if (name === 'style' && tag !== 'svg') for (const decl of value.split(';')) f.styles.add(`${tag}{${decl.split(':')[0].trim()}}`);
    }
  }
}
for (const [family, f] of families) {
  console.log(`\n## ${family}`);
  console.log('tags', [...f.tags].map(([t, n]) => `${t}:${n}`).join(' '));
  console.log('attrs', [...f.attrs].filter((a) => !a.startsWith('svg.')).join(' '));
  console.log('classes', [...f.classes].join(' '));
  console.log('transforms', [...f.transforms].join(' | '));
  console.log('styles', [...f.styles].join(' '));
}
