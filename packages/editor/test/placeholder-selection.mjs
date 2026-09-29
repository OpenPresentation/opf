import assert from "node:assert/strict";
import { allocatedSelectionBox } from "../dist/canvas.js";

const box = { x: 57.6, y: 240, width: 1164.8, height: 65.88 };
const ink = { x: 57.6, y: 252, width: 312, height: 42 };

test("short headings use the allocated item box, not glyph ink", () => {
  const node = mockNode({ getBBox: () => ink });
  assert.deepEqual(allocatedSelectionBox(node, { box }), box);
});

test("code and metric parts keep traced part boxes over the parent item", () => {
  const part = { x: 80, y: 300, width: 400, height: 48 };
  const parent = { x: 57.6, y: 180, width: 1164.8, height: 420 };
  const node = mockNode({
    attributes: { "data-opf-code-role": "body", "data-opf-box-x": String(part.x), "data-opf-box-y": String(part.y), "data-opf-box-width": String(part.width), "data-opf-box-height": String(part.height) },
    getBBox: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  });
  assert.deepEqual(allocatedSelectionBox(node, { box: parent }), part);
  const metric = mockNode({
    attributes: { "data-opf-metric-role": "value", "data-opf-box-x": String(part.x), "data-opf-box-y": String(part.y), "data-opf-box-width": String(part.width), "data-opf-box-height": String(part.height) },
  });
  assert.deepEqual(allocatedSelectionBox(metric, { box: parent }), part);
});

test("source-text traces and rich-line fallbacks still provide a selectable box", () => {
  const traced = { x: 57.6, y: 120, width: 1164.8, height: 80 };
  const heading = mockNode({
    attributes: {
      "data-opf-source-text": "true",
      "data-opf-box-x": String(traced.x),
      "data-opf-box-y": String(traced.y),
      "data-opf-box-width": String(traced.width),
      "data-opf-box-height": String(traced.height),
    },
    getBBox: () => ink,
  });
  assert.deepEqual(allocatedSelectionBox(heading, { box }), traced);
  const rich = mockNode({
    attributes: {
      "data-opf-rich-lines": JSON.stringify([{ x: 10, y: 20, height: 18 }, { x: 10, y: 38, height: 18 }]),
      "data-opf-box-width": "200",
    },
    getBBox: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  });
  assert.deepEqual(allocatedSelectionBox(rich), { x: 10, y: 20, width: 200, height: 36 });
});

function test(name, run) {
  run();
  console.log(`PASS ${name}`);
}

function mockNode({ attributes = {}, getBBox } = {}) {
  const dataset = {};
  for (const [name, value] of Object.entries(attributes)) {
    const match = /^data-opf-box-(x|y|width|height)$/.exec(name);
    if (match) dataset[`opfBox${match[1][0].toUpperCase()}${match[1].slice(1)}`] = value;
  }
  return {
    dataset,
    hasAttribute: (name) => Object.hasOwn(attributes, name),
    getAttribute: (name) => attributes[name] ?? null,
    getBBox,
  };
}
