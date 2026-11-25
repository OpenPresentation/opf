// FR-07: the table color scale (table.colorScale): OKLab, the computed fills and text colors, the rules, layout and paging.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  colorContrast, layoutTable, mixOklab, oklabToSrgb, resolveColorRef, resolveTableColorScale, srgbToOklab, tableColorScaleText,
} from '../dist/composition.js';
import { resolveSlideContext, tableRows, validate } from '../dist/index.js';
import { paginateSlide } from '../dist/pagination.js';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';
import { fromYaml, toYaml } from '../dist/yaml.js';

const close = (actual, expected, epsilon, message) => assert.ok(Math.abs(actual - expected) <= epsilon, `${message ?? ''} ${actual} vs ${expected}`);

// A fixed palette: the colors a test scale resolves against.
const palette = { surface: '#FFFFFF', primary: '#0000FF', accent1: '#1B9E4B', accent2: '#C0392B', text: '#111111', background: '#FFFFFF' };
const colors = { resolve: (name) => palette[name] ?? '#808080', text: palette.text };
const shades = (table) => Object.fromEntries(resolveTableColorScale(table, colors).cells.map((cell) => [`${cell.row}:${cell.column}`, cell.fill]));

describe('OKLab (FR-07)', () => {
  test('white, black, a primary red and a mid gray come out at the published values', () => {
    const [wl, wa, wb] = srgbToOklab('#FFFFFF');
    close(wl, 1, 1e-4, 'white L'); close(wa, 0, 1e-4); close(wb, 0, 1e-4);
    assert.deepEqual(srgbToOklab('#000000').map((value) => Math.abs(value) < 1e-9), [true, true, true]);
    const [rl, ra, rb] = srgbToOklab('#FF0000');
    close(rl, 0.62796, 1e-4, 'red L'); close(ra, 0.22486, 1e-4, 'red a'); close(rb, 0.12585, 1e-4, 'red b');
    const [gl, ga, gb] = srgbToOklab('#808080');
    close(gl, 0.59987, 1e-4, 'gray L'); close(ga, 0, 1e-4); close(gb, 0, 1e-4);
  });

  test('the conversion round-trips to the same sRGB color', () => {
    for (const hex of ['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#808080', '#AF231B', '#2693A1', '#EFA517']) assert.equal(oklabToSrgb(srgbToOklab(hex)), hex);
  });

  test('the two ends of a mix come back exactly as given, and the middle is between them', () => {
    assert.equal(mixOklab('#AF231B', '#2693A1', 0), '#AF231B');
    assert.equal(mixOklab('#AF231B', '#2693A1', 1), '#2693A1');
    assert.equal(mixOklab('#af231b', '#2693a1', -3), '#AF231B');
    assert.equal(mixOklab('#AF231B', '#2693A1', 7), '#2693A1');
    const middle = srgbToOklab(mixOklab('#000000', '#FFFFFF', 0.5));
    close(middle[0], 0.5, 0.01, 'half way in lightness');
    assert.equal(mixOklab('#FFFFFF', '#000000', 0.5), '#636363', 'OKLab half way between white and black is not the sRGB 7F7F7F');
  });
});

describe('the computed fills (FR-07)', () => {
  const quarters = { columns: ['Region', 'Q1', 'Q2'], rows: [['EMEA', 10, 20], ['APAC', 30, 40], ['AMER', 50, 60]] };

  test('a sequential scale runs from surface to primary over the lowest and highest number of every named column', () => {
    const table = { ...quarters, colorScale: { columns: ['Q1', 'Q2'] } };
    const fills = shades(table);
    assert.equal(fills['0:1'], '#FFFFFF', 'the lowest value is the from color, exactly');
    assert.equal(fills['2:2'], '#0000FF', 'the highest value is the to color, exactly');
    assert.equal(fills['0:0'], undefined, 'a column that is not named is not shaded');
    assert.equal(Object.keys(fills).length, 6);
    assert.equal(resolveTableColorScale(table, colors).range.min, 10);
    // One scale shared by the columns: equal numbers get equal colors.
    const equal = shades({ columns: ['K', 'A', 'B'], rows: [['x', 5, 9], ['y', 9, 1]], colorScale: { columns: ['A', 'B'] } });
    assert.equal(equal['0:2'], equal['1:1']);
  });

  test('min and max pin the range, and a value outside it takes the end color', () => {
    const fills = shades({ ...quarters, colorScale: { columns: ['Q1'], min: 0, max: 100, colors: ['accent1', 'accent2'] } });
    assert.notEqual(fills['0:1'], '#1B9E4B');
    assert.equal(shades({ ...quarters, colorScale: { columns: ['Q1'], min: 20, max: 40, colors: ['accent1', 'accent2'] } })['0:1'], '#1B9E4B', 'below min');
    assert.equal(shades({ ...quarters, colorScale: { columns: ['Q1'], min: 20, max: 40, colors: ['accent1', 'accent2'] } })['2:1'], '#C0392B', 'above max');
  });

  test('a diverging scale draws the center in mid with each side on its own span', () => {
    const table = { columns: ['Product', 'YoY'], rows: [['A', 0.12], ['B', -0.08], ['C', 0], ['D', 0.03]], colorScale: { columns: ['YoY'], colors: ['accent2', 'surface', 'accent1'], center: 0 } };
    const fills = shades(table);
    assert.equal(fills['0:1'], '#1B9E4B', 'the highest value is to');
    assert.equal(fills['2:1'], '#FFFFFF', 'the center is mid');
    // Symmetric around the center: the largest distance (0.12) is the end, so -0.08 is two thirds of the way to from, not at from.
    assert.equal(fills['1:1'], mixOklab('#FFFFFF', '#C0392B', 2 / 3));
    assert.equal(fills['3:1'], mixOklab('#FFFFFF', '#1B9E4B', 0.25));
    // Without center the values spanning both signs center on 0, positive-only values on the middle of the range.
    const spanning = shades({ ...table, colorScale: { columns: ['YoY'], colors: ['accent2', 'surface', 'accent1'] } });
    assert.deepEqual(spanning, fills);
    const positive = shades({ columns: ['K', 'V'], rows: [['a', 10], ['b', 20], ['c', 30]], colorScale: { columns: ['V'], colors: ['accent2', 'surface', 'accent1'] } });
    assert.equal(positive['1:1'], '#FFFFFF');
  });

  test('a diverging scale with no pinned end is symmetric: a lone small negative is pale, equal distances get equal strength', () => {
    const table = (rows, extra = {}) => ({ columns: ['K', 'V'], rows, colorScale: { columns: ['V'], colors: ['accent2', 'surface', 'accent1'], center: 0, ...extra } });
    const lone = shades(table([['a', 10], ['b', -1], ['c', 5]]));
    const strength = (fill, end) => { const [l] = srgbToOklab('#FFFFFF'), [e] = srgbToOklab(end), [f] = srgbToOklab(fill); return (l - f) / (l - e); };
    assert.ok(strength(lone['1:1'], '#C0392B') < 0.2, 'a lone -1 among +10 is pale: ' + lone['1:1']);
    assert.equal(lone['1:1'], mixOklab('#FFFFFF', '#C0392B', 0.1));
    const equal = shades(table([['a', 6], ['b', -6], ['c', 12]]));
    const [lightness] = srgbToOklab('#FFFFFF');
    const [up] = srgbToOklab(equal['0:1']), [down] = srgbToOklab(equal['1:1']);
    // Equal magnitudes sit at the same fraction of the way from mid to their ends.
    assert.equal(equal['0:1'], mixOklab('#FFFFFF', '#1B9E4B', 0.5));
    assert.equal(equal['1:1'], mixOklab('#FFFFFF', '#C0392B', 0.5));
    assert.ok(lightness > up && lightness > down);
    // A pinned end keeps that end exactly, each side on its own span.
    const pinned = shades(table([['a', 10], ['b', -1]], { min: -2 }));
    assert.equal(pinned['0:1'], '#1B9E4B');
    assert.equal(pinned['1:1'], mixOklab('#FFFFFF', '#C0392B', 0.5));
    // Sequential scales are unchanged.
    assert.equal(shades({ columns: ['K', 'V'], rows: [['a', -1], ['b', 10]], colorScale: { columns: ['V'] } })['0:1'], '#FFFFFF');
  });

  test('a range on one side of the center draws only that side', () => {
    const above = shades({ columns: ['K', 'V'], rows: [['a', 5], ['b', 9]], colorScale: { columns: ['V'], colors: ['accent2', 'surface', 'accent1'], center: 0 } });
    assert.equal(above['0:1'], mixOklab('#FFFFFF', '#1B9E4B', 5 / 9));
    assert.equal(above['1:1'], '#1B9E4B');
    const below = shades({ columns: ['K', 'V'], rows: [['a', -5], ['b', -9]], colorScale: { columns: ['V'], colors: ['accent2', 'surface', 'accent1'], center: 0 } });
    assert.equal(below['1:1'], '#C0392B');
    assert.equal(below['0:1'], mixOklab('#C0392B', '#FFFFFF', 4 / 9));
  });

  test('equal values draw at the to color (sequential) or at mid when equal to the center', () => {
    assert.deepEqual(Object.values(shades({ columns: ['K', 'V'], rows: [['a', 4], ['b', 4]], colorScale: { columns: ['V'] } })), ['#0000FF', '#0000FF']);
    assert.deepEqual(Object.values(shades({ columns: ['K', 'V'], rows: [['a', 0], ['b', 0]], colorScale: { columns: ['V'], colors: ['surface', 'surface', 'primary'], center: 0 } })), ['#FFFFFF', '#FFFFFF']);
  });

  test('only finite numbers are shaded; a cell fill of its own is kept and still counts towards the range', () => {
    const table = {
      columns: ['K', 'V'],
      rows: [['a', 0], ['b', '12'], ['c', null], ['d', true], ['e', [{ text: '5' }]], ['f', { value: 100, style: { fill: '#FF00FF' } }], ['g', { value: 50, format: '0' }], ['h', Number.NaN]],
      colorScale: { columns: ['V'] },
    };
    const result = resolveTableColorScale(table, colors);
    assert.deepEqual(result.cells.map((cell) => cell.row), [0, 6]);
    assert.equal(result.range.max, 100, 'the cell with its own fill counts');
    assert.equal(result.at(0, 1).fill, '#FFFFFF');
    assert.equal(result.at(5, 1), undefined, 'the cell with its own fill keeps it');
    assert.equal(result.at(6, 1).fill, mixOklab('#FFFFFF', '#0000FF', 0.5));
  });

  test('columns match by header text: rich runs, styled headers, DataColumns and two columns with one header', () => {
    const table = {
      columns: [[{ text: 'Re' }, { text: 'gion' }], { name: 'Q1', format: '0%' }, { value: 'Q2', style: { bold: true } }, 'Q1'],
      rows: [['EMEA', 0.2, 3, 8], ['APAC', 0.4, 6, 9]],
      colorScale: { columns: ['Q1', 'Q2'] },
    };
    assert.deepEqual(resolveTableColorScale(table, colors).cells.map((cell) => `${cell.row}:${cell.column}`).sort(), ['0:1', '0:2', '0:3', '1:1', '1:2', '1:3']);
    assert.deepEqual(resolveTableColorScale({ ...table, columns: undefined }, colors).cells, [], 'no header row, no named column');
  });

  test('rows written as { id, cells } are read as array rows are', () => {
    const table = { columns: ['K', 'V'], rows: [{ id: 'r1', cells: ['a', 1] }, ['b', 3], { id: 'r3', cells: ['c', 2] }], colorScale: { columns: ['V'] } };
    assert.equal(tableRows(table).length, 3);
    const fills = shades(table);
    assert.deepEqual(fills, { '0:1': '#FFFFFF', '1:1': '#0000FF', '2:1': mixOklab('#FFFFFF', '#0000FF', 0.5) });
  });

  test('the text color is the scheme text color where it reads (4.5:1), else black or white', () => {
    assert.equal(tableColorScaleText('#FFFFFF', colors), '#111111');
    assert.equal(tableColorScaleText('#0000FF', colors), '#FFFFFF');
    assert.equal(tableColorScaleText('#306DFF', colors), '#000000', 'neither the scheme text nor white reads: black');
    // The ends are the contract (4.5:1); a mid-tone mix between two ends can have no text color that reaches it.
    const ends = resolveTableColorScale({ columns: ['K', 'V'], rows: [['a', 1], ['b', 5]], colorScale: { columns: ['V'] } }, colors).cells;
    for (const cell of ends) assert.ok(colorContrast(cell.text, cell.fill) >= 4.5, `${cell.fill} ${cell.text}`);
  });

  test('a table without a color scale, or with an unusable one, has no shaded cell', () => {
    assert.deepEqual(resolveTableColorScale(quarters, colors).cells, []);
    assert.deepEqual(resolveTableColorScale({ ...quarters, colorScale: { columns: [] } }, colors).cells, []);
    assert.deepEqual(resolveTableColorScale({ ...quarters, colorScale: { columns: ['Nope'] } }, colors).cells, []);
    assert.equal(resolveTableColorScale({ ...quarters, colorScale: { columns: ['Region'] } }, colors).range, undefined);
  });
});

describe('the scale in the table layout (FR-07)', () => {
  const table = { columns: ['Region', 'Q1'], rows: [['EMEA', 0.2], ['APAC', 0.4]], colorScale: { columns: ['Q1'] }, highlight: { rows: ['APAC'] } };
  const box = { x: 0, y: 0, width: 800, height: 300 };

  test('number cells of the named column are scaled, the header and other columns are not, and a scale wins over the highlight tint', () => {
    const layout = layoutTable(table, box, { colorScale: colors, highlight: [1] });
    const cells = layout.rows.flatMap((row) => row.cells);
    assert.deepEqual(cells.filter((cell) => cell.scaled).map((cell) => [cell.row, cell.column]), [[1, 1], [2, 1]]);
    const apac = cells.find((cell) => cell.row === 2 && cell.column === 1);
    assert.equal(apac.highlighted, true);
    assert.equal(apac.scaled.fill, '#0000FF');
    assert.equal(cells.find((cell) => cell.row === 2 && cell.column === 0).scaled, undefined);
  });

  test('without the colors an engine passes, or without a scale, no cell is scaled and the layout is the one it was', () => {
    const plain = layoutTable({ ...table, colorScale: undefined }, box, { highlight: [1] });
    assert.deepEqual(layoutTable(table, box, { highlight: [1] }), plain);
    assert.deepEqual(layoutTable({ ...table, colorScale: undefined }, box, { colorScale: colors, highlight: [1] }), plain);
  });

  test('a dataset-backed table is scaled by the dataset column names after fields', () => {
    const presentation = { datasets: { sales: { columns: ['Region', 'Q1', 'Q2'], rows: [['EMEA', 1, 9], ['APAC', 3, 5]] } } };
    const layout = layoutTable({ dataset: 'sales', fields: ['Region', 'Q2'], colorScale: { columns: ['Q2'] } }, box, { colorScale: colors, presentation });
    assert.deepEqual(layout.rows.flatMap((row) => row.cells).filter((cell) => cell.scaled).map((cell) => [cell.row, cell.column, cell.scaled.fill]), [[1, 1, '#0000FF'], [2, 1, '#FFFFFF']]);
  });
});

describe('a paged table keeps one range (FR-07)', () => {
  test('every page of a split table is shaded over the whole table', () => {
    const rows = Array.from({ length: 40 }, (_, index) => [`Row ${index + 1}`, index * 10]);
    const table = { columns: ['Name', 'Score'], rows, colorScale: { columns: ['Score'] } };
    const { slides } = paginateSlide({ title: 'Scores', table }, { width: 1280, height: 720, minFontSize: 24 });
    assert.ok(slides.length > 1, 'the table is split');
    const first = resolveTableColorScale(slides[0].table, colors), last = resolveTableColorScale(slides.at(-1).table, colors);
    assert.deepEqual([first.range.min, first.range.max], [0, 390]);
    assert.deepEqual([last.range.min, last.range.max], [0, 390]);
    // The same value has the same color on every page: the last page's first row is far from the lowest value.
    const whole = resolveTableColorScale(table, colors);
    const index = Number(last.cells[0].value) / 10;
    assert.equal(last.cells[0].fill, whole.at(index, 1).fill);
    // A diverging scale is pinned at its symmetric ends.
    const diverging = paginateSlide({ title: 'Change', table: { columns: ['Name', 'Change'], rows: rows.map(([name, value]) => [name, value - 100]), colorScale: { columns: ['Change'], colors: ['surface', 'surface', 'primary'], center: 0 } } }, { width: 1280, height: 720, minFontSize: 24 });
    assert.ok(diverging.slides.length > 1);
    for (const page of diverging.slides) assert.deepEqual([page.table.colorScale.min, page.table.colorScale.max, page.table.colorScale.center], [-290, 290, 0]);
    // A table that fits on one page is not rewritten.
    const small = paginateSlide({ title: 'Scores', table: { ...table, rows: rows.slice(0, 3) } }, { width: 1280, height: 720 });
    assert.equal(small.slides.length, 1);
    assert.deepEqual(small.slides[0].table.colorScale, { columns: ['Score'] });
  });
});

describe('the rules (FR-07)', () => {
  const deck = (table) => ({ name: 'Scale', slides: [{ title: 'Win rate', table }] });
  const base = { columns: ['Region', 'Q1', 'Q2'], rows: [['EMEA', 0.22, 0.25], ['APAC', 0.18, 0.21]] };
  const found = (table) => validate(deck(table)).findings.filter((finding) => finding.ruleId.startsWith('opf/table-color-scale') || finding.path?.includes('colorScale'));

  test('a valid scale, sequential or diverging, has no finding', () => {
    assert.deepEqual(found({ ...base, colorScale: { columns: ['Q1', 'Q2'], min: 0, max: 0.4 } }), []);
    assert.deepEqual(found({ ...base, colorScale: { columns: ['Q1'], colors: ['accent2', 'surface', 'accent1'], center: 0.2 } }), []);
  });

  test('a name no column has is an error at the name', () => {
    const [finding, ...rest] = found({ ...base, colorScale: { columns: ['Q1', 'Q4'] } });
    assert.equal(rest.length, 0);
    assert.equal(finding.ruleId, 'opf/table-color-scale-unknown-column');
    assert.equal(finding.severity, 'error');
    assert.equal(finding.path, '/slides/0/table/colorScale/columns/1');
    assert.match(finding.message, /^The color scale names "Q4", which is no column of this table\. Columns: "Region", "Q1", "Q2"\.$/);
  });

  test('an empty columns list, a raw color, a hyperlink color and center without mid are schema errors', () => {
    for (const colorScale of [{ columns: [] }, { columns: ['Q1'], colors: ['#FF0000', 'primary'] }, { columns: ['Q1'], colors: ['surface', 'var:brand'] }, { columns: ['Q1'], colors: ['surface', 'hyperlink'] }, { columns: ['Q1'], colors: ['surface'] }, { columns: ['Q1'], colors: ['surface', 'accent1', 'primary', 'text'] }, { columns: ['Q1'], center: 0 }, { columns: ['Q1'], colors: ['surface', 'primary'], center: 0 }, { columns: ['Q1', 'Q1'] }, { columns: ['Q1'], unknown: 1 }, { columns: ['Q1'], from: 'surface' }]) {
      const result = validate(deck({ ...base, colorScale }));
      assert.equal(result.valid, false, JSON.stringify(colorScale));
      assert.ok(result.findings.some((finding) => finding.severity === 'error' && finding.path?.startsWith('/slides/0/table/colorScale')), JSON.stringify(colorScale));
    }
  });

  test('no numbers, an empty range and a center outside the range are warnings, not errors', () => {
    const noData = validate(deck({ columns: ['Region', 'Q1'], rows: [['EMEA', 'n/a']], colorScale: { columns: ['Q1'] } }));
    assert.equal(noData.valid, true);
    assert.deepEqual(noData.findings.filter((finding) => finding.ruleId === 'opf/table-color-scale-no-data').map((finding) => [finding.severity, finding.path]), [['warning', '/slides/0/table/colorScale']]);
    const range = validate(deck({ ...base, colorScale: { columns: ['Q1'], min: 0.5, max: 0.4 } }));
    assert.equal(range.valid, true);
    assert.deepEqual(range.findings.filter((finding) => finding.ruleId === 'opf/table-color-scale-range').map((finding) => finding.severity), ['warning']);
    const center = validate(deck({ ...base, colorScale: { columns: ['Q1'], colors: ['surface', 'surface', 'primary'], center: 5, min: 0, max: 0.4 } }));
    assert.deepEqual(center.findings.filter((finding) => finding.ruleId === 'opf/table-color-scale-range').map((finding) => finding.severity), ['warning']);
  });

  test('a dataset-backed table names dataset columns after fields', () => {
    const datasets = { sales: { columns: ['Region', 'Q1', 'Q2'], rows: [['EMEA', 1, 2]] } };
    const make = (table) => ({ name: 'Scale', datasets, slides: [{ title: 'T', table: { dataset: 'sales', ...table } }] });
    assert.deepEqual(validate(make({ colorScale: { columns: ['Q2'] } })).findings.filter((finding) => finding.ruleId.includes('color-scale')), []);
    const hidden = validate(make({ fields: ['Region', 'Q1'], colorScale: { columns: ['Q2'] } })).findings.filter((finding) => finding.ruleId.includes('color-scale'));
    assert.deepEqual(hidden.map((finding) => [finding.ruleId, finding.path]), [['opf/table-color-scale-unknown-column', '/slides/0/table/colorScale/columns/0']]);
  });
});

describe('every gallery color scheme (FR-07)', () => {
  test('the default scale and a diverging scale keep their text at 4.5:1 on both ends, in every theme, default and dark', () => {
    let lowest = { ratio: Infinity, label: '' };
    let checked = 0;
    for (const theme of Object.keys(gallery.themes)) for (const colorScheme of Object.keys(gallery.colorSchemes)) for (const variant of [undefined, 'dark1']) {
      const deck = { design: { theme, colorScheme, ...(variant ? { variant } : {}) }, slides: [{ title: 'T', text: 'x' }] };
      const { resolved } = resolveSlideContext(deck, 0, { catalogs: [gallery] });
      const resolve = (name) => resolveColorRef(name, { colorScheme: resolved.colorScheme, roles: resolved.roles, variables: {}, fallback: '#000000' }).slice(0, 7);
      const scheme = { resolve, text: resolved.roles.text.slice(0, 7) };
      for (const [name, scale] of [['surface to primary', { columns: ['V'] }], ['accent2 / surface / accent1', { columns: ['V'], colors: ['accent2', 'surface', 'accent1'], center: 0 }]]) {
        const result = resolveTableColorScale({ columns: ['K', 'V'], rows: [['lowest', -1], ['highest', 1]], colorScale: scale }, scheme);
        assert.equal(result.cells[0].fill, resolve(scale.colors?.[0] ?? 'surface'), 'the lowest value is the first color as the scheme resolves it');
        assert.equal(result.cells[1].fill, resolve(scale.colors?.at(-1) ?? 'primary'), 'the highest value is the last color as the scheme resolves it');
        for (const [end, cell] of [['from', result.cells[0]], ['to', result.cells[1]]]) {
          const ratio = colorContrast(cell.text, cell.fill);
          if (ratio < lowest.ratio) lowest = { ratio, label: `${theme} ${colorScheme} ${variant ?? 'default'}, ${name}, ${end} end (${cell.fill} with ${cell.text})` };
          assert.ok(ratio >= 4.5, `${theme} ${colorScheme} ${variant ?? 'default'} ${name} ${end}: ${cell.text} on ${cell.fill} is ${ratio}`);
        }
        checked++;
      }
    }
    assert.equal(checked, Object.keys(gallery.themes).length * Object.keys(gallery.colorSchemes).length * 4);
    console.log(`lowest contrast ratio over ${checked} scales: ${lowest.ratio.toFixed(2)}:1 at ${lowest.label}`);
  });
});

describe('Markdown and YAML (FR-07)', () => {
  const document = () => ({
    name: 'Scale',
    slides: [
      { title: 'Win rate', table: { columns: ['Region', { name: 'Q1', format: '0%' }, { name: 'Q2', format: '0%' }], rows: [['EMEA', 0.22, 0.25], ['APAC', 0.18, 0.21]], colorScale: { columns: ['Q1', 'Q2'], min: 0, max: 0.4 } } },
      { title: 'Year on year', table: { columns: ['Product', 'YoY'], rows: [['Core', 0.12], ['Add-ons', -0.08]], colorScale: { columns: ['YoY'], colors: ['accent2', 'surface', 'accent1'], center: 0 } } },
    ],
  });

  test('a sequential and a diverging scale round-trip through YAML', () => {
    const { yaml } = toYaml(document());
    assert.match(yaml, /colorScale:/);
    const back = fromYaml(yaml);
    assert.deepEqual(back.findings.filter((finding) => finding.severity === 'error'), []);
    assert.deepEqual(back.presentation.slides.map((slide) => slide.table), document().slides.map((slide) => slide.table));
  });

  test('a sequential and a diverging scale round-trip through Markdown', () => {
    const { markdown } = toMarkdown(document());
    assert.match(markdown, /colorScale:/);
    const back = fromMarkdown(markdown, {});
    assert.deepEqual(back.findings.filter((finding) => finding.severity === 'error'), []);
    assert.deepEqual(back.presentation.slides.map((slide) => slide.table), document().slides.map((slide) => slide.table));
  });
});
