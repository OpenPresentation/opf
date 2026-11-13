// RR-105 (coverage finding 02): a link's (or an underlined run's) underline ends with the line's last visible character. A decorated
// fragment at the end of a left-to-right line is drawn without its trailing white space; the line's text, its other fragments and their
// positions are unchanged. Checked with measured fonts (the CLI and the editor) and without (a browser estimate).
import assert from 'node:assert/strict';
import { loadFonts } from '../dist/fonts-node.js';
import { toSvg } from '../dist/index.js';

const text = ['Read the ', { text: 'release notes', link: 'https://openpresentation.org/' }, ', call ', { text: 'the desk', link: 'https://example.com/desk' }, ' or write to ', { text: 'support', link: 'mailto:support@example.com' }, '. The French team calls it the plan.'];
const decorated = svg => [...svg.matchAll(/<(text|tspan)\b[^>]*text-decoration="underline"[^>]*>([^<]*)<\/\1>/g)].map(match => match[2]);
const fonts = await loadFonts({ pack: 'office' });
let found = 0;
for (const options of [{ fonts }, {}]) {
  for (let index = 0; index < 80; index++) {
    const pad = 'word '.repeat(Math.floor(index / 4)) + 'x'.repeat(index % 4);
    const deck = { language: 'en-US', design: { background: 'light1' }, slides: [{ title: 'Links', text: [pad + text[0], ...text.slice(1)] }] };
    const svg = toSvg(deck, 1, { ...options, trace: true });
    const words = decorated(svg);
    // Every underlined piece ends with a visible character.
    for (const word of words) assert.match(word, /\S$/u, `an underlined piece ends with a visible character: ${JSON.stringify(word)}`);
    // The line that breaks inside "the desk" underlines "the" (no space) at its end.
    if (words.includes('the') && words.includes('desk')) found++;
  }
}
assert.ok(found > 0, 'some padding breaks the line inside the link');
// A blank decorated fragment at a line end (an underlined space run) draws no underline.
const blank = toSvg({ language: 'en-US', slides: [{ title: 'T', text: ['A line that ends with an underlined space', { text: ' ', underline: true }] }] }, 1, { fonts });
assert.ok(!decorated(blank).some(word => !/\S/u.test(word)));
console.log(`RR-105 link underline at a line end: ${found} wrapped links checked.`);
