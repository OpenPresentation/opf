import { toSvg, toPng } from 'file:///C:/opf-work/sh-02-shape-block/packages/render/dist/index.js';
import fs from 'node:fs';
const deck = { name: 'S', language: 'en-US', slides: [{ title: 'Shapes', blocks: [
  { shape: 'chevron', text: 'Plan' },
  { shape: 'ellipse', text: 'Build', fill: { color: 'accent2', lighten: 0.4 }, stroke: { color: 'text', width: 3, dash: 'dash' } },
  { shape: 'roundRect', adjust: { adj: 0.3 }, text: [{ text: 'Ship', bold: true }], style: 'intense', rotate: 10 },
  { path: 'M0 0 L1 0 L0.5 1 Z', fill: { gradient: { type: 'linear', angle: 0, stops: [{ color: 'accent1', position: 0 }, { color: 'accent3', position: 1 }] } }, stroke: { width: 8, compound: 'double', color: 'text' } },
  { shape: 'arc', stroke: { width: 4, color: 'accent2', end: { type: 'triangle' }, start: { type: 'oval' } }, fill: 'none' },
  { shape: 'can', style: 'subtle', text: 'Data' },
] }] };
const svg = await toSvg(deck);
const s = Array.isArray(svg) ? svg[0] : svg.slides?.[0] ?? svg;
fs.writeFileSync('C:/opf-work/shapes/sh-02/t2.svg', typeof s === 'string' ? s : JSON.stringify(s).slice(0, 2000));
const png = await toPng(deck, { slides: [1] }).catch(e => { console.log('png', e.message); return null; });
if (png) { const b = Array.isArray(png) ? png[0] : png; fs.writeFileSync('C:/opf-work/shapes/sh-02/t2.png', b.png ?? b.data ?? b); }
console.log(typeof svg, Array.isArray(svg));
