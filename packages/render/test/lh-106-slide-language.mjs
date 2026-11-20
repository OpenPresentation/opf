import assert from 'node:assert/strict';
import { toSvg } from '../dist/index.js';
const deck = { language: 'en-US', slides: [
  { title: 'English', text: 'A simple sentence.' },
  { language: 'ar-SA', title: 'العربية', items: ['الأول', 'الثاني'] },
  { language: 'fr-FR', title: 'Résultats', chart: { type: 'column', data: { columns: ['Année', 'Ventes'], rows: [['2025', 1500], ['2026', 3000]] } } },
] };
const svg = toSvg(deck);
assert.match(svg[0], /lang="en-US"/);
assert.match(svg[1], /lang="ar-SA"/);
assert.match(svg[1], /text-anchor="end"/);
assert.ok(svg[1].includes('⁧الأول⁩'), 'Arabic words stay in RTL isolates');
assert.match(svg[2], /lang="fr-FR"/);
assert.ok(svg[2].includes('1 500') || svg[2].includes('1 500'), 'chart labels use the slide locale');
console.log('LH-106: per-slide SVG language, direction and number formats');
