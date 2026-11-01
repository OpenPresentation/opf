import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CE-29: docs/styling.md is the styling contract of the editor's chrome, and this test keeps it true. For every part it parses the tables of the
// part's section (`| Hook | Kind | What it is |`) and fails when
//   - a listed class or attribute no longer appears in the part's source (the DOM the part builds),
//   - a listed token is no longer read by the part's CSS, or a listed value of an attribute is no longer in the source,
//   - the icon names listed differ from the names the part's `.d.ts` accepts in `icons`,
//   - the part's root class is missing from the doc (or its section is), a section has no CSS example, or an example names a class,
//     attribute or token that does not exist,
//   - a stylesheet of `src/styles` is neither covered by a documented part nor on the list of files that are not part of the contract yet.
// A new part adds one entry to PARTS and one section to the doc.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n');
const doc = read('docs/styling.md');

/** The documented parts: the doc section, the root hook, the modules that build the DOM, the stylesheets that read the tokens and the typings. */
const PARTS = {
  'Toolbar': { root: '.opf-tb', js: ['toolbar.js', 'workspace-shell.js'], css: ['toolbar.css', 'workspace.css'], types: 'toolbar.d.ts' },
  'Deck title': { root: '.opf-title', js: ['deck-title.js'], css: ['deck-title.css'], types: 'deck-title.d.ts' },
  'Expand': { root: '.opf-expand-button', js: ['editor-expand.js', 'workspace.js'], css: ['expand.css'], types: 'editor-expand.d.ts' },
  'Design menu': { root: '.opf-design-menu', js: ['design-menu.js'], css: ['design-menu.css'], types: 'design-menu.d.ts' },
  'Review pill': { root: '.opf-review-pill', js: ['review-pill.js'], css: ['review-pill.css'], types: 'review-pill.d.ts' },
  'Help': { root: '.opf-help-button', js: ['shortcuts-sheet.js'], css: ['shortcuts-sheet.css', 'shortcuts.css'], types: 'shortcuts-sheet.d.ts' },
  'Toolbar actions': { root: '.opf-actions', js: ['toolbar-actions.js'], css: ['toolbar-actions.css'], types: 'toolbar-actions.d.ts' },
  'Slide navigator': { root: '.opf-nav', js: ['slide-navigator.js'], css: ['navigator.css'], types: 'slide-navigator.d.ts' },
  'Thumbnail strip': { root: '.opf-thumbs', js: ['thumbnail-strip.js'], css: ['thumbnails.css'], types: 'thumbnail-strip.d.ts' },
  'The element': { root: 'opf-editor', js: ['element.js'], css: ['expand.css'], types: 'element.d.ts' },
};
// Stylesheets that are not part of this contract (yet): the source pane, the studio, the panels and the other parts of the playground.
const NOT_DOCUMENTED = ['tokens.css', 'touch.css', 'panels.css', 'source-pane.css', 'source-navigation.css', 'studio.css', 'layout-editor.css', 'export-menu.css', 'handoff.css', 'presenter.css'];

// ---- parse the doc -------------------------------------------------------------------------------------------------------------------------
const sections = new Map();
for (const chunk of doc.split(/^## /m).slice(1)) {
  const title = chunk.slice(0, chunk.indexOf('\n')).trim();
  const body = chunk.slice(chunk.indexOf('\n') + 1);
  const rows = [];
  for (const line of body.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((cell) => cell.trim());
    const hook = /^`([^`]+)`$/.exec(cells[0] ?? '');
    if (!hook || cells.length < 3) continue; // the header, the separator and any other table
    rows.push({ hook: hook[1], kind: cells[1], text: cells[2] });
  }
  const examples = [...body.matchAll(/```css\n([\s\S]*?)```/g)].map((match) => match[1]);
  sections.set(title, { rows, examples });
}

const KINDS = new Set(['root', 'class', 'attribute', 'token', 'icon']);
assert.deepEqual([...sections.keys()].filter((name) => !(name in PARTS)), [], 'every section of docs/styling.md is a part this test knows (add it to PARTS)');
const sourceOf = (files, folder = 'src') => files.map((file) => read(`${folder}/${file}`)).join('\n');
const has = (haystack, needle) => new RegExp(`(?<![\\w-])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(haystack);
const camel = (attribute) => attribute.replace(/^data-/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const tokensCss = read('src/styles/tokens.css');
const everySource = readdirSync(path.join(root, 'src')).filter((name) => name.endsWith('.js')).map((name) => read(`src/${name}`)).join('\n')
  + readdirSync(path.join(root, 'src/styles')).map((name) => read(`src/styles/${name}`)).join('\n');
const documentedAttributes = new Set();
let checked = 0;

for (const [name, part] of Object.entries(PARTS)) {
  const section = sections.get(name);
  assert.ok(section, `docs/styling.md has a section "${name}"`);
  const js = sourceOf(part.js);
  const css = sourceOf(part.css, 'src/styles').replace(/\/\*[\s\S]*?\*\//g, '');
  const types = read(`src/${part.types}`);
  assert.ok(section.rows.length > 0, `"${name}" lists its hooks in a table`);
  assert.ok(section.examples.length > 0, `"${name}" has a CSS example`);
  for (const row of section.rows) assert.ok(KINDS.has(row.kind), `"${name}": ${row.hook} has the kind "${row.kind}", which is none of ${[...KINDS].join(', ')}`);

  // The root class is in the doc, as the root, and in the part's source.
  assert.ok(section.rows.some((row) => row.kind === 'root' && row.hook === part.root), `"${name}": the root ${part.root} is listed with the kind root`);
  assert.equal(section.rows.filter((row) => row.kind === 'root').length, 1, `"${name}" has exactly one root`);

  for (const row of section.rows) {
    const where = `"${name}": ${row.hook}`;
    if (row.kind === 'root' || row.kind === 'class') {
      if (row.hook.startsWith('.')) assert.ok(has(js, row.hook.slice(1)), `${where} is no longer built by ${part.js.join(' or ')}`);
      else assert.ok(has(js, row.hook), `${where} (the tag) is no longer in ${part.js.join(' or ')}`);
    } else if (row.kind === 'attribute') {
      const attribute = row.hook;
      assert.ok(/^(data|aria)-[a-z-]+$/.test(attribute), `${where} is a data- or aria- attribute`);
      assert.ok(has(js, attribute) || (attribute.startsWith('data-') && has(js, `dataset.${camel(attribute)}`)), `${where} is no longer set by ${part.js.join(' or ')}`);
      documentedAttributes.add(attribute);
      // The values the doc names in backticks (`editable`, `touch`, `true`) are strings of the source or the CSS.
      for (const [, value] of row.text.matchAll(/`([a-z][a-z-]*)`/g)) {
        if (/^(data|aria)-/.test(value)) continue;
        assert.ok(has(js, value) || has(css, value) || value === 'true', `${where}: the value "${value}" is in neither ${part.js.join(' or ')} nor its CSS`);
      }
    } else if (row.kind === 'token') {
      assert.ok(row.hook.startsWith('--opf-'), `${where} is a custom property`);
      assert.ok(css.includes(`var(${row.hook}`), `${where} is no longer read by ${part.css.join(' or ')}`);
      if (row.hook.startsWith('--opf-ui-')) assert.ok(new RegExp(`${row.hook}\\s*:`).test(tokensCss), `${where} is in tokens.css`);
    }
    checked++;
  }

  // The icon names are exactly the ones the typings accept.
  const listed = section.rows.filter((row) => row.kind === 'icon').map((row) => row.hook).sort();
  const typed = [...types.matchAll(/OpfIcons<([^>]+)>/g)].flatMap((match) => [...match[1].matchAll(/"([a-z-]+)"/g)].map((name) => name[1]));
  assert.deepEqual(listed, [...new Set(typed)].sort(), `"${name}": the icon names in the doc are the names in ${part.types}`);
}

// ---- the examples name things that exist -------------------------------------------------------------------------------------------------
for (const [name, section] of sections) {
  for (const example of section.examples) {
    const code = example.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, className] of code.matchAll(/\.(opf-[a-z0-9-]+|is-primary)\b/g)) assert.ok(has(everySource, className), `"${name}": the example uses .${className}, which no longer exists`);
    for (const [, attribute] of code.matchAll(/\[((?:data|aria)-[a-z-]+)/g)) assert.ok(documentedAttributes.has(attribute), `"${name}": the example uses [${attribute}], which docs/styling.md does not list`);
    for (const [, token] of code.matchAll(/var\((--opf-[a-z0-9-]+)/g)) assert.ok(new RegExp(`${token}\\s*:`).test(tokensCss), `"${name}": the example reads ${token}, which is not a token`);
    for (const [, token] of code.matchAll(/^\s*(--opf-[a-z0-9-]+)\s*:/gm)) assert.ok(new RegExp(`${token}\\s*:`).test(tokensCss), `"${name}": the example sets ${token}, which is not a token`);
  }
}

// ---- a stylesheet nobody documented is a decision --------------------------------------------------------------------------------------
const covered = new Set(Object.values(PARTS).flatMap((part) => part.css));
const orphan = readdirSync(path.join(root, 'src/styles')).filter((file) => file.endsWith('.css') && !covered.has(file) && !NOT_DOCUMENTED.includes(file));
assert.deepEqual(orphan, [], 'every stylesheet of src/styles is documented in docs/styling.md (add its part to PARTS) or listed in NOT_DOCUMENTED');

// ---- the doc is linked and the lever list is honest ----------------------------------------------------------------------------------------
assert.match(read('docs/theming.md'), /\]\(styling\.md\)/, 'docs/theming.md links docs/styling.md');
assert.match(doc, /styles\.layered\.css/, 'docs/styling.md names the layered stylesheet');
assert.ok(JSON.parse(read('package.json')).exports['./styles.layered.css'], 'the layered stylesheet is exported');

console.log(`styling contract checks passed (${checked} hooks in ${sections.size} parts)`);
