// O1/O4 for test sources and prose: the unambiguous patterns of the logical left/right -> start/end rename and run `lang` -> `language`.
// Regex-based on purpose (tests hold decks as JS literals, JSON strings, YAML and Markdown); what it cannot decide it leaves.
// usage: node o1-tests.mjs [--check] <file>...
import fs from 'node:fs';
const side = (word) => (word === 'left' ? 'start' : word === 'right' ? 'end' : word);
const cols = (text) => text.split('+').map(side).join('+');
const PAYLOAD = 'text|items|bullets|image|chart|table|code|metric|quote|timeline|diagram|blocks|video|shape|path|type|id|socials|date|caption|numbering|\\.\\.\\.';
const Q = `(?:\\\\?["'\`])?`; // an optional quote, possibly escaped inside a JSON string
const rules = [
  // A. compound region keys, anywhere: top:left, middle+bottom:center+right, left+center, center+right
  [/\b((?:top|middle|bottom)(?:\+(?:top|middle|bottom))*):((?:left|center|right)(?:\+(?:left|center|right))*)\b(?![-\w])/g, (m, rows, columns) => `${rows}:${cols(columns)}`],
  [/(?<![-\w.])(left\+center(?:\+right)?|center\+right)\b(?![-\w])/g, (m, key) => cols(key)],
  // B. design hints
  [new RegExp(`\\b(titleAlignment|contentAlignment|chartPrimary)(${Q}\\s*[:=,]\\s*${Q})(left|right)\\b`, 'g'), (m, key, mid, value) => `${key}${mid}${side(value)}`],
  // C. paths
  [/\b(slides[./](?:\d+|\$\{[^}]+\})[./])(left|right)\b(?![-\w+])/g, (m, head, key) => `${head}${side(key)}`],
  [/\b((?:header|footer)[./])(left|right)\b(?![-\w+])/g, (m, head, key) => `${head}${side(key)}`],
  // C2. property access on a slide: slides[0].left, slide.right, slides.at(-1).left
  [/\b(slides(?:\[[^\]]+\]|\.at\([^)]*\))\??\.)(left|right)\b(?![-\w+(])/g, (m, head, key) => `${head}${side(key)}`],
  [/\b(slide\??\.)(left|right)\b(?![-\w+(])/g, (m, head, key) => `${head}${side(key)}`],
  // D/E. a region or a header/footer zone as a key whose value is a payload object
  [new RegExp(`([{,\\[(]\\s*${Q})(left|right)(${Q}\\s*:\\s*\\{\\s*${Q})(${PAYLOAD})`, 'g'), (m, head, key, mid, first) => `${head}${side(key)}${mid}${first}`],
  // F. image placement and overlay bands
  [new RegExp(`\\b((?:placement|overlay)${Q}\\s*:\\s*\\{[^{}]*?\\bedge${Q}\\s*:\\s*${Q})(left|right)\\b`, 'g'), (m, head, value) => `${head}${side(value)}`],
  // G. captions
  [new RegExp(`\\b(caption${Q}\\s*:\\s*\\{[^{}]*?\\balign${Q}\\s*:\\s*${Q})(left|right)\\b`, 'g'), (m, head, value) => `${head}${side(value)}`],
  // H. table cell styles
  [new RegExp(`\\b(style${Q}\\s*:\\s*\\{[^{}]*?\\balign${Q}\\s*:\\s*${Q})(left|right)\\b`, 'g'), (m, head, value) => `${head}${side(value)}`],
  // I. a text run's language
  [new RegExp(`(\\{[^{}]*\\btext${Q}\\s*:[^{}]*?[,{\\s]${Q})lang(${Q}\\s*:)`, 'g'), (m, head, tail) => `${head}language${tail}`],
  [new RegExp(`(\\{\\s*${Q})lang(${Q}\\s*:[^{}]*?\\btext${Q}\\s*:)`, 'g'), (m, head, tail) => `${head}language${tail}`],
  // J. Markdown block options
  [/\bregion=(left|right)\b(?![-\w+:])/g, (m, key) => `region=${side(key)}`],
  // K. YAML
  [new RegExp(`(^|\\n)([ \\t]*)(left|right):([ \\t]*\\n[ \\t]+(?:${PAYLOAD})\\b)`, 'g'), (m, lead, indent, key, rest) => `${lead}${indent}${side(key)}:${rest}`],
];
const check = process.argv.includes('--check'); let files = 0, edits = 0;
for (const file of process.argv.slice(2).filter((arg) => !arg.startsWith('--'))) {
  let text; try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  let next = text, count = 0;
  for (const [pattern, replace] of rules) for (let pass = 0; pass < 4; pass++) { const before = next; next = next.replace(pattern, (...args) => { const out = replace(...args); if (out !== args[0]) count++; return out; }); if (next === before) break; }
  if (next === text) continue;
  files++; edits += count;
  if (process.argv.includes('--list')) console.log(`  ${file} (${count})`);
  if (!check) fs.writeFileSync(file, next);
}
console.log(`${check ? 'would change' : 'changed'} ${files} files, ${edits} edits`);
