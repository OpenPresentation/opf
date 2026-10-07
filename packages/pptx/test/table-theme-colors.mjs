import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {catalogs, validate} from '@openpresentation/opf';
import {toPptx, fromPptx} from '../dist/index.js';
import {themeSlotColors, writeThemeColors} from '../dist/theme-colors.js';

// FF-24c: table cell fills, borders and text that name a theme slot or role, and
// the engine's own table chrome (header accent, body surface, border, paired text),
// are written as a:schemeClr and resolve to the deck theme; authored literals stay
// literal. A theme switch recolors exactly the referenced parts.

const SLOT_NAMES = ['light1', 'dark1', 'light2', 'dark2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hyperlink', 'followedHyperlink'];
const ROLE_NAMES = ['primary', 'secondary', 'accent', 'text', 'textSecondary', 'surface', 'background'];
const NAMES = [...SLOT_NAMES, ...ROLE_NAMES];
const CLR = {dk1: 'dark1', lt1: 'light1', dk2: 'dark2', lt2: 'light2', tx1: 'dark1', bg1: 'light1', tx2: 'dark2', bg2: 'light2', hlink: 'hyperlink', folHlink: 'followedHyperlink'};
const hex = value => value.replace(/^#/, '').toUpperCase();
const parts = bytes => unzipSync(new Uint8Array(bytes));
const slideXml = (entries, index = 1) => {
  const xml = strFromU8(entries[`ppt/slides/slide${index}.xml`]);
  assert.equal(XMLValidator.validate(xml), true, 'slide XML');
  return xml;
};
const themeSlots = entries => {
  const scheme = strFromU8(entries['ppt/theme/theme1.xml']).match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/)[0];
  const byElement = {};
  for (const [, element, value] of scheme.matchAll(/<a:(\w+)><a:srgbClr val="([0-9A-F]{6})"\/>/g).map(m => [m[0], m[1], m[2]])) byElement[element] = value;
  return byElement;
};
const clrOf = (xml) => {
  const match = xml?.match(/<a:(srgbClr|schemeClr) val="([^"]+)"/);
  return match ? {kind: match[1] === 'schemeClr' ? 'scheme' : 'srgb', val: match[2]} : undefined;
};
// Resolve a scheme value through the vendored master map (bg1=lt1, tx1=dk1, ...).
const resolve = (color, theme) => color.kind === 'srgb' ? color.val
  : theme[{tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2'}[color.val] ?? color.val];
const rowsOf = xml => [...xml.matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)].map(row => [...row[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map(cell => {
  const body = cell[0];
  const tcPr = body.match(/<a:tcPr[\s\S]*?<\/a:tcPr>/)[0];
  const borders = {};
  for (const edge of ['L', 'R', 'T', 'B']) borders[edge] = clrOf(tcPr.match(new RegExp(`<a:ln${edge}\\b[\\s\\S]*?</a:ln${edge}>`))?.[0]);
  return {
    text: [...body.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => m[1]).join(''),
    fill: clrOf(tcPr.replace(/<a:ln[LRTB]\b[\s\S]*?<\/a:ln[LRTB]>/g, '')),
    color: clrOf(body.match(/<a:rPr[\s\S]*?<\/a:rPr>/)?.[0]),
    borders,
  };
}));
const edgeColors = cell => Object.values(cell.borders);

// 1. Every catalog color scheme on four theme backgrounds: every named slot or role
// is a scheme reference for fill, text and all four borders, and resolves to exactly
// the literal the same slide exports when pinned by a slide-level scheme.
const authored = name => ({value: name, style: {fill: name, color: name, borders: Object.fromEntries(['top', 'right', 'bottom', 'left'].map(edge => [edge, {color: name, width: 1}]))}});
let references = 0;
for (const record of catalogs.colorSchemes) {
  for (const slot of [undefined, 'dark1', 'light2', 'dark2']) {
    const design = {colorScheme: record.id, ...(slot ? {background: {type: 'theme', slot}} : {})};
    const table = {columns: ['Name', 'Value'], rows: NAMES.map(name => [name, authored(name)])};
    const entries = parts(await toPptx({design, slides: [{title: 'Named', table}]}));
    const pinned = parts(await toPptx({design, slides: [{title: 'Named', design: {colorScheme: record.id}, table}]}));
    const theme = themeSlots(entries);
    for (const [element, value] of Object.entries(theme)) if (CLR[element] || /^accent\d$/.test(element)) assert.equal(value, hex(record[CLR[element] ?? element]), `${record.id} theme ${element}`);
    const rows = rowsOf(slideXml(entries)), literal = rowsOf(slideXml(pinned));
    assert.equal(rows.length, NAMES.length + 1);
    assert.doesNotMatch(slideXml(pinned).match(/<a:tbl>[\s\S]*<\/a:tbl>/)[0], /schemeClr/, 'a slide with its own scheme keeps a literal table, chrome included');
    for (const [index, name] of NAMES.entries()) {
      const cell = rows[index + 1][1], expected = literal[index + 1][1], where = `${record.id} ${slot ?? 'default'} ${name}`;
      for (const [part, actual, want] of [['fill', cell.fill, expected.fill], ['text', cell.color, expected.color], ...Object.keys(cell.borders).map(edge => [`border ${edge}`, cell.borders[edge], expected.borders[edge]])]) {
        assert.equal(actual?.kind, 'scheme', `${where} ${part} is a scheme reference`);
        assert.equal(resolve(actual, theme), want.val, `${where} ${part} resolves to the pinned literal`);
        references++;
      }
    }
  }
}

// 2. The engine's own table chrome follows the theme too: header accent fill,
// surface body fill, accent5 borders and text paired with its fill. Nothing in a
// default table is a literal slot color, for every scheme on light and dark decks.
let chrome = 0;
for (const record of catalogs.colorSchemes) {
  // The default theme (minimal) is a dark2 deck; light1 and light2 decks use the bg2 surface.
  for (const slot of [undefined, 'dark1', 'light1', 'light2']) {
    const dark = slot === undefined || slot === 'dark1' || slot === 'dark2';
    const design = {colorScheme: record.id, ...(slot ? {background: {type: 'theme', slot}} : {})};
    const table = {columns: ['Head', 'Head 2'], rows: [['a', 'b'], ['c', 'd']]};
    const entries = parts(await toPptx({design, slides: [{title: 'Default', table}]}));
    const pinned = parts(await toPptx({design, slides: [{title: 'Default', design: {colorScheme: record.id}, table}]}));
    const theme = themeSlots(entries);
    const rows = rowsOf(slideXml(entries)), literal = rowsOf(slideXml(pinned));
    for (const [r, row] of rows.entries()) for (const [c, cell] of row.entries()) {
      const want = literal[r][c], where = `${record.id} ${slot ?? 'default'} r${r}c${c}`;
      for (const [part, actual, expected] of [['fill', cell.fill, want.fill], ['text', cell.color, want.color], ...Object.keys(cell.borders).map(edge => [`border ${edge}`, cell.borders[edge], want.borders[edge]])]) {
        assert.equal(actual.kind, 'scheme', `${where} ${part} is a scheme reference`);
        assert.equal(resolve(actual, theme), expected.val, `${where} ${part} resolves to the pinned literal`);
        chrome++;
      }
      assert.equal(cell.fill.val, r === 0 ? 'accent1' : (dark ? 'tx2' : 'bg2'), `${where} fill role`);
      assert.deepEqual(edgeColors(cell).map(color => color.val), ['accent5', 'accent5', 'accent5', 'accent5']);
      if (r > 0) assert.equal(cell.color.val, dark ? 'bg1' : 'tx1', `${where} body text pairs with the surface`);
      else assert.match(cell.color.val, /^(bg1|tx1)$/, `${where} header text is light1 or dark1`);
    }
  }
}

// 3. Authored literals stay literal, including a literal that equals a theme slot,
// document variables, and the default text on a literal fill.
const forest = catalogs.colorSchemes.find(record => record.id === 'forest-green');
const literalTable = {columns: ['A', 'B'], rows: [
  ['equal', {value: 'accent1 hex', style: {fill: forest.accent1, color: forest.light1, borders: {top: {color: forest.accent2, width: 1}}}}],
  ['vars', {value: 'variable', style: {fill: 'var:risk', color: 'var:risk', borders: {bottom: {color: 'var:risk', width: 1}}}}],
  ['plain', {value: 'literal fill', style: {fill: '#123456'}}],
  ['mixed', {value: 'named fill, literal text', style: {fill: 'accent3', color: '#FEDCBA'}}],
  ['alpha', {value: 'translucent', style: {fill: '#4A7C5980', color: 'accent1', borders: {left: {color: 'accent1', width: 1}}}}],
]};
const literalDeck = {design: {colorScheme: 'forest-green'}, variables: {risk: '#B42318'}, slides: [{title: 'Literals', table: literalTable}]};
const literalRows = rowsOf(slideXml(parts(await toPptx(literalDeck))));
const cellOf = label => literalRows.flat().find(cell => cell.text === label);
const equal = cellOf('accent1 hex');
assert.deepEqual([equal.fill, equal.color, equal.borders.T], [{kind: 'srgb', val: hex(forest.accent1)}, {kind: 'srgb', val: hex(forest.light1)}, {kind: 'srgb', val: hex(forest.accent2)}], 'a literal that equals a slot stays literal');
const variable = cellOf('variable');
assert.deepEqual([variable.fill, variable.color, variable.borders.B], Array(3).fill({kind: 'srgb', val: 'B42318'}));
const plain = cellOf('literal fill');
assert.deepEqual(plain.fill, {kind: 'srgb', val: '123456'});
assert.equal(plain.color.kind, 'srgb', 'default text on a literal fill stays literal');
const mixed = cellOf('named fill, literal text');
assert.deepEqual([mixed.fill.kind, mixed.fill.val, mixed.color], ['scheme', 'accent3', {kind: 'srgb', val: 'FEDCBA'}]);
const translucent = cellOf('translucent');
assert.deepEqual(translucent.fill, {kind: 'srgb', val: '4A7C59'}, 'a translucent literal fill stays literal');
assert.deepEqual([translucent.color.kind, translucent.color.val, translucent.borders.L.kind, translucent.borders.L.val], ['scheme', 'accent1', 'scheme', 'accent1']);

// 4. hyperlink and followedHyperlink. PptxGenJS cannot write them, so a reserved literal is
// rewritten in the slide part. It never reaches the package, and a document that uses one
// of the reserved values keeps its own literal.
const linkTable = {columns: ['A', 'B'], rows: [['links', {value: 'link', style: {fill: 'hyperlink', color: 'followedHyperlink', borders: {top: {color: 'hyperlink', width: 1}}}}], ['runs', {value: [{text: 'linked run', color: 'hyperlink'}, ' ', {text: 'followed run', color: 'followedHyperlink'}]}]]};
for (const reserved of [[], ['#FE01A0'], ['#FE01A1', '#FE02B0'], ['#FE01A0', '#FE02B0', '#FE03C0']]) {
  const deck = {design: {colorScheme: 'forest-green'}, slides: [{title: 'Links', table: linkTable, text: reserved.map((color, index) => ({text: `keep${index}`, color}))}]};
  const entries = parts(await toPptx(deck)), xml = slideXml(entries), where = reserved.join(',') || 'none';
  const authoredHex = reserved.map(hex);
  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.endsWith('.xml') || name.startsWith('ppt/tags/')) continue;
    for (const value of ['FE01A0', 'FE01A1', 'FE02B0', 'FE02B1', 'FE03C0', 'FE03C1']) {
      const count = strFromU8(bytes).split(value).length - 1;
      assert.equal(count, name === 'ppt/slides/slide1.xml' && authoredHex.includes(value) ? 1 : 0, `${name} carries ${value} only where the document authored it (${where})`);
    }
  }
  if (reserved.length === 0 || reserved.length < 3) {
    const cell = rowsOf(xml)[1][1];
    assert.deepEqual([cell.fill, cell.color, cell.borders.T], [{kind: 'scheme', val: 'hlink'}, {kind: 'scheme', val: 'folHlink'}, {kind: 'scheme', val: 'hlink'}], where);
    const runColor = text => xml.match(new RegExp(`<a:rPr[^>]*>(?:(?!</a:rPr>)[\\s\\S])*</a:rPr><a:t>${text}</a:t>`))?.[0].match(/<a:schemeClr val="([^"]+)"/)?.[1];
    assert.deepEqual([runColor('linked run'), runColor('followed run')], ['hlink', 'folHlink'], `${where} table runs`);
  } else {
    // Every reserved pair is authored: the link colors stay literal rather than colliding.
    const cell = rowsOf(xml)[1][1];
    assert.deepEqual([cell.fill, cell.color], [{kind: 'srgb', val: hex(forest.hyperlink)}, {kind: 'srgb', val: hex(forest.followedHyperlink)}], where);
  }
  for (const [index, color] of reserved.entries()) assert.match(xml, new RegExp(`<a:srgbClr val="${hex(color)}"`), `authored ${color} stays literal (${where}, keep${index})`);
}

// 5. Re-import and theme switch. The package resolves to the same colors, design.colorScheme
// returns as the catalog id, and switching the theme in the package recolors exactly the
// references (named parts and the engine chrome) while authored literals stay put.
const boost = catalogs.colorSchemes.find(record => record.id === 'boost');
const switched = catalogs.colorSchemes.find(record => record.id === 'corporate-blue');
const deck = {
  design: {colorScheme: 'boost', background: {type: 'theme', slot: 'dark1'}},
  slides: [{title: 'Switch', table: {columns: ['Named', 'Literal'], rows: [
    [{value: 'slots', style: {fill: 'accent2', color: 'light1', borders: {bottom: {color: 'accent4', width: 2}}}}, {value: 'fixed', style: {fill: '#123456', color: '#FEDCBA', borders: {bottom: {color: '#00AA00', width: 2}}}}],
    ['default', 'default too'],
  ]}}],
};
const source = await toPptx(deck);
const importTable = async bytes => {
  const diagnostics = [];
  const document = await fromPptx(bytes, {onDiagnostic: d => diagnostics.push(d)});
  assert.equal(validate(document, {only: ['format']}).valid, true);
  assert.deepEqual(diagnostics.filter(d => /table/.test(d.code)), []);
  const found = [];
  (function visit(node) { if (node && typeof node === 'object') { if (node.table) found.push(node.table); Object.values(node).forEach(visit); } })(document.slides[0]);
  return {document, table: found[0], design: diagnostics.filter(d => d.path?.startsWith('design.'))};
};
const plainText = cell => { const value = cell?.value ?? cell; return Array.isArray(value) ? value.map(run => typeof run === 'string' ? run : run.text).join('') : value; };
const before = await importTable(source);
assert.deepEqual(before.design, [], 'an unedited export imports without design diagnostics');
assert.equal(before.document.design.colorScheme, 'boost', 'the recovered design.colorScheme is the catalog id');
const cells = table => Object.fromEntries([...(table.columns ? [table.columns] : []), ...table.rows].flat().map(cell => [plainText(cell), cell]));
const named = cells(before.table);
assert.equal(named.slots.style.fill, `#${hex(boost.accent2)}`);
assert.equal(named.slots.value[0].color, `#${hex(boost.light1)}`);
assert.equal(named.slots.style.borders.bottom.color, `#${hex(boost.accent4)}`);
assert.equal(named.fixed.style.fill, '#123456');

const themeFor = record => themeSlotColors(record);
const entries = parts(source);
entries['ppt/theme/theme1.xml'] = strToU8(writeThemeColors(strFromU8(entries['ppt/theme/theme1.xml']), {colors: themeFor(switched), schemeName: switched.name}));
const after = await importTable(zipSync(entries));
assert.deepEqual(after.design.map(d => [d.code, d.path]), [['design-reference-changed', 'design.colorScheme']], 'the changed theme is reported once and the observed scheme is kept');
assert.equal(after.document.design.colorScheme, 'corporate-blue', 'the switched theme is recognized as its catalog scheme');
const moved = cells(after.table);
assert.equal(moved.slots.style.fill, `#${hex(switched.accent2)}`, 'named fill follows the theme');
assert.equal(moved.slots.value[0].color, `#${hex(switched.light1)}`, 'named text follows the theme');
assert.equal(moved.slots.style.borders.bottom.color, `#${hex(switched.accent4)}`, 'named border follows the theme');
assert.equal(moved.fixed.style.fill, '#123456', 'literal fill does not move');
assert.equal(moved.fixed.value[0].color, '#FEDCBA', 'literal text does not move');
assert.equal(moved.fixed.style.borders.bottom.color, '#00AA00', 'literal border does not move');
const header = (table, index) => (table.columns ?? [])[index]?.style;
assert.equal(header(before.table, 0)?.fill, `#${hex(boost.accent1)}`, 'default header fill is accent1');
assert.equal(header(after.table, 0)?.fill, `#${hex(switched.accent1)}`, 'default header fill follows the theme');
const surface = table => plainText(table.rows[1][0]) === 'default' ? table.rows[1][0].style?.fill : undefined;
assert.equal(surface(before.table), `#${hex(boost.dark2)}`, 'default body fill is the dark2 surface on a dark deck');
assert.equal(surface(after.table), `#${hex(switched.dark2)}`, 'default body fill follows the theme');

// 6. Determinism: repeated exports are byte-identical.
const again = await toPptx(deck);
assert.deepEqual(new Uint8Array(again), new Uint8Array(source), 'export is deterministic');
const twice = await toPptx(literalDeck), thrice = await toPptx(literalDeck);
assert.deepEqual(new Uint8Array(twice), new Uint8Array(thrice));
console.log(JSON.stringify({test: 'table-theme-colors', passed: true, schemes: catalogs.colorSchemes.length, namedReferences: references, chromeReferences: chrome}));
