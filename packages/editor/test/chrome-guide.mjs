import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CE-30: docs/chrome-guide.md and examples/chrome/ say the same thing. A fenced block whose info string names an example region
// (```js embed.js#mount) must equal that region of the file, line for line (the region's common indent removed). A region is the lines between
// `#region <name>` and `#endregion` markers, in a `//` comment, an HTML comment or a CSS comment. The guide also has to use every example, its
// relative links have to resolve, and every region in the examples has to be one the guide shows or be named in the exceptions below.
const root = fileURLToPath(new URL('../', import.meta.url));
const examples = path.join(root, 'examples', 'chrome');
const guidePath = path.join(root, 'docs', 'chrome-guide.md');
const guide = readFileSync(guidePath, 'utf8').replace(/\r\n/g, '\n');

const dedent = (lines) => {
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(cut).trimEnd());
};
const normalize = (lines) => {
  const out = dedent(lines);
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join('\n');
};

function regionsOf(file) {
  const lines = readFileSync(path.join(examples, file), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const found = new Map();
  for (let at = 0; at < lines.length; at++) {
    const start = lines[at].match(/#region\s+([\w-]+)/);
    if (!start) continue;
    assert.ok(!found.has(start[1]), `${file}: region ${start[1]} is defined twice`);
    const end = lines.findIndex((line, index) => index > at && /#endregion/.test(line));
    assert.ok(end > at, `${file}: region ${start[1]} is never closed`);
    found.set(start[1], normalize(lines.slice(at + 1, end)));
  }
  return found;
}

// The guide's tagged fences: ```<lang> <file>#<region>
const fences = [...guide.matchAll(/^```(\w*)[ \t]+([\w.-]+)#([\w-]+)[ \t]*\n([\s\S]*?)\n```[ \t]*$/gm)].map((match) => ({ lang: match[1], file: match[2], region: match[3], body: match[4] }));
assert.ok(fences.length >= 20, `the guide shows its examples (${fences.length} tagged blocks)`);

const cache = new Map();
const used = new Set();
for (const { file, region, body } of fences) {
  assert.ok(existsSync(path.join(examples, file)), `the guide names ${file}, which is not in examples/chrome`);
  if (!cache.has(file)) cache.set(file, regionsOf(file));
  const regions = cache.get(file);
  assert.ok(regions.has(region), `${file} has no region "${region}" (it has: ${[...regions.keys()].join(', ') || 'none'})`);
  assert.equal(normalize(body.split('\n')), regions.get(region), `the guide's ${file}#${region} differs from the example`);
  used.add(`${file}#${region}`);
}

// Every example page and script is shown at least once.
const names = ['embed', 'viewer', 'full', 'own-header', 'headless', 'react', 'element', 'styled'];
for (const name of names) {
  const files = readdirSync(examples).filter((file) => file.startsWith(`${name}.`));
  assert.ok(files.length >= 2, `${name} is a page and an entry (${files})`);
  assert.ok(fences.some(({ file }) => file.startsWith(`${name}.`)), `the guide shows a region of ${name}`);
  assert.ok(guide.includes(`examples/chrome/${name}.html`), `the guide links ${name}.html`);
}

// Regions that exist only so that the example reads well and are not worth a block in the guide stay out of the check below by name.
const NOT_IN_GUIDE = new Set([]);
for (const [file, regions] of cache) for (const region of regions.keys()) if (!used.has(`${file}#${region}`) && !NOT_IN_GUIDE.has(`${file}#${region}`)) assert.fail(`${file}#${region} is not shown in the guide`);
for (const file of readdirSync(examples).filter((name) => /\.(js|jsx|html)$/.test(name))) {
  if (cache.has(file)) continue;
  for (const region of regionsOf(file).keys()) if (!used.has(`${file}#${region}`)) assert.fail(`${file}#${region} is not shown in the guide`);
}

// Relative links resolve (to a file or a heading of the same page).
const slug = (heading) => heading.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
const headings = new Set([...guide.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => slug(match[1])));
for (const [, target] of guide.matchAll(/\]\(([^)\s]+)\)/g)) {
  if (/^[a-z]+:/i.test(target)) continue;
  const [file, anchor] = target.split('#');
  if (!file) assert.ok(headings.has(anchor), `the guide links to #${anchor}, which is not one of its headings`);
  else assert.ok(existsSync(path.join(path.dirname(guidePath), file)), `the guide links ${file}, which does not exist`);
}

// The sections the guide promises.
for (const heading of ['Add an editor to a page in 5 minutes', 'Pick a preset', 'Choose and order toolbar items', 'Put items in your own header', 'Go headless', 'Rename the deck', 'Expand to full screen', 'Unsaved changes and saving', 'Host buttons', 'Restyle it', 'Use the web component', 'React and Svelte', 'In an iframe']) {
  assert.match(guide, new RegExp(`^## ${heading}$`, 'm'), `the guide has the section "${heading}"`);
}

console.log(`chrome guide checks passed: ${fences.length} blocks equal their example regions, ${names.length} examples shown, links and sections present`);
