import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { layoutTemplate } from '../dist/composition.js';

// FA-33: a layout record is one ordered list of regions. The compile of that tree must give the grid the engine always
// composed with, so rendering is unchanged. The fixtures are the 28 records of @openpresentation/gallery 4.0.0 in the old
// grid form (gallery-4-layouts.json: areas, columns, rows and the regions map) and the grid, region rules and areas the
// engine built from each of them before FA-33 (gallery-4-grids.json, produced by the old reader). Each old record is
// converted to the new form below, compiled, and compared with that grid.
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/layout-regions/${name}.json`, import.meta.url), 'utf8'));
const records = fixture('gallery-4-layouts');
const grids = fixture('gallery-4-grids');
const HEADINGS = ['title', 'subtitle'];

// Old grid to region list: cut the grid along a row or column boundary no area crosses, and recurse. Every gallery
// record is a guillotine partition, so this always finishes. All the cuts of one axis are taken at once, so a list is
// never split again along its own axis.
function convert(old) {
  const rows = old.rows ?? old.areas.map(() => 1);
  const columns = old.columns ?? old.areas[0].map(() => 1);
  const cells = old.areas;
  const crossing = (axis, at, from, to) => {
    for (let index = from; index <= to; index++) if (axis === 'row' ? cells[at - 1][index] === cells[at][index] : cells[index][at - 1] === cells[index][at]) return true;
    return false;
  };
  const leaf = (name, size, parentDirection) => {
    const entry = { name };
    if (HEADINGS.includes(name)) {
      const implicit = parentDirection === 'column' ? 'auto' : 1;
      if (size !== implicit) entry.size = size;
      return entry;
    }
    if (size !== 1) entry.size = size;
    return { ...entry, ...old.regions[name] };
  };
  // The list of the rectangle [r0..r1] x [c0..c1]; `along` is the direction of the list it becomes.
  const list = (r0, r1, c0, c1) => {
    const horizontal = [];
    for (let at = r0 + 1; at <= r1; at++) if (!crossing('row', at, c0, c1)) horizontal.push(at);
    if (horizontal.length) return { direction: 'column', entries: segments('column', [r0, ...horizontal, r1 + 1], (from, to) => [from, to - 1, c0, c1]) };
    const vertical = [];
    for (let at = c0 + 1; at <= c1; at++) if (!crossing('column', at, r0, r1)) vertical.push(at);
    if (vertical.length) return { direction: 'row', entries: segments('row', [c0, ...vertical, c1 + 1], (from, to) => [r0, r1, from, to - 1]) };
    return undefined;
  };
  const segments = (direction, edges, rectangle) => edges.slice(0, -1).map((from, index) => {
    const to = edges[index + 1];
    const [r0, r1, c0, c1] = rectangle(from, to);
    const weights = direction === 'column' ? rows.slice(from, to) : columns.slice(from, to);
    const size = weights.includes('auto') ? 'auto' : weights.reduce((sum, weight) => sum + weight, 0);
    const inner = list(r0, r1, c0, c1);
    if (!inner) return leaf(cells[r0][c0], size, direction);
    return { direction: inner.direction, ...(size !== 1 ? { size } : {}), regions: inner.entries };
  });
  const top = list(0, cells.length - 1, 0, cells[0].length - 1);
  if (!top) {
    const size = rows[0] === 'auto' ? 'auto' : rows[0];
    return { direction: 'column', regions: [leaf(cells[0][0], size, 'column')] };
  }
  return { direction: top.direction, regions: top.entries };
}

const compiled = (template) => ({
  rows: template.rows,
  columns: template.columns,
  grid: template.grid,
  areas: template.areas,
  regions: template.regions,
  ...(template.overflowRegion !== undefined ? { overflowRegion: template.overflowRegion } : {}),
  title: template.title,
  subtitle: template.subtitle,
});
const depth = (list) => 1 + Math.max(0, ...list.filter((entry) => entry.regions).map((entry) => depth(entry.regions)));

describe('the 28 gallery 4 layouts, converted to a region list', () => {
  test('the fixtures are the 28 gallery 4.0.0 records', () => {
    assert.equal(Object.keys(records).length, 28);
    assert.deepEqual(Object.keys(grids), Object.keys(records));
  });

  for (const [id, old] of Object.entries(records)) {
    test(`${id}: the region list compiles to the grid and region rules the engine always built`, () => {
      const { areas, columns, rows, regions, ...rest } = old;
      const record = { ...rest, ...convert(old) };
      for (const key of ['areas', 'columns', 'rows']) assert.equal(key in record, false);
      assert.ok(Array.isArray(record.regions));
      assert.deepEqual(compiled(layoutTemplate(record)), grids[id]);
    });
  }

  test('seven records need a split: the heading above a row of two, and the two that nest past it', () => {
    const nested = Object.entries(records).filter(([, old]) => convert(old).regions.some((entry) => entry.regions)).map(([id]) => id);
    assert.deepEqual(nested, ['chart-beside', 'code', 'comparison', 'hero', 'image-beside', 'table-beside', 'two-column']);
    for (const old of Object.values(records)) assert.ok(depth(convert(old).regions) <= 3);
  });
});

describe('an anchor written once at the record', () => {
  test('the records whose body regions all share a non-default anchor compile the same with it on the record', () => {
    const hoisted = [];
    for (const [id, old] of Object.entries(records)) {
      const anchors = Object.values(old.regions).map((region) => region.anchor);
      if (!anchors.length || !anchors[0] || anchors.some((anchor) => anchor !== anchors[0])) continue;
      const converted = convert(old);
      const strip = (list) => list.map((entry) => entry.regions ? { ...entry, regions: strip(entry.regions) } : { ...entry, anchor: undefined });
      const record = JSON.parse(JSON.stringify({ ...converted, anchor: anchors[0], regions: strip(converted.regions) }));
      assert.equal(JSON.stringify(record.regions).includes('"anchor"'), false);
      assert.deepEqual(compiled(layoutTemplate(record)), grids[id], id);
      hoisted.push(id);
    }
    assert.deepEqual(hoisted, ['quote', 'statement']);
  });

  test('a heading region never inherits it', () => {
    const template = layoutTemplate({ name: 'x', anchor: 'bottom', regions: [{ name: 'title' }, { name: 'body', accepts: ['text'] }] });
    assert.deepEqual(template.regions.map((region) => region.anchor), ['bottom']);
    assert.equal(template.areas.find((area) => area.name === 'title').heading, true);
  });
});
