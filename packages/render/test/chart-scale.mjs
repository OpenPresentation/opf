import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { validate } from "@openpresentation/opf/validator";

// Exercise the public renderer in a bounded worker: a scale-search regression
// must fail this test rather than freeze the test runner/browser event loop.
const renderer = new URL("../dist/svg.js", import.meta.url).href;
async function render(document) {
  assert.equal(validate(document, { only: ["format"] }).valid, true);
  return new Promise((resolve, reject) => {
    let timer;
    const worker = new Worker(`
      const {parentPort, workerData} = require("node:worker_threads");
      import(workerData.renderer).then(({renderSlideSvg}) => {
        const before = JSON.stringify(workerData.document);
        parentPort.postMessage({ready:true});
        try {
          const svg = renderSlideSvg(workerData.document, 0, {trace:true});
          parentPort.postMessage({svg, unchanged:before === JSON.stringify(workerData.document)});
        } catch (error) {
          parentPort.postMessage({error:{name:error.name, message:error.message}, unchanged:before === JSON.stringify(workerData.document)});
        }
      }).catch(error => { throw error; });
    `, { eval: true, workerData: { renderer, document } });
    worker.on("error", (error) => { clearTimeout(timer); reject(error); });
    worker.on("message", (message) => {
      if (message.ready) {
        timer = setTimeout(() => {
          void worker.terminate();
          reject(new Error("renderSlideSvg did not complete within 2 seconds after import"));
        }, 2000);
      } else {
        clearTimeout(timer);
        assert.equal(message.unchanged, true, "rendering/rejection leaves authored data unchanged");
        resolve(message);
      }
    });
  });
}

const elements = (svg) => [...svg.matchAll(/<(rect|circle|line|polyline|path)\b([^>]*)\/?\s*>/g)].map(([, tag, attributes]) => ({
  tag, ...Object.fromEntries([...attributes.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))
}));
const pointPath = /^slides\.0\.chart\.data\.rows\.\d+\.1$/;
const coordinateKeys = ["x", "y", "width", "height", "cx", "cy", "r", "x1", "x2", "y1", "y2", "stroke-width"];
function finiteGeometry(svg) {
  assert.doesNotMatch(svg, /NaN|Infinity/, "no non-finite SVG values");
  const shapes = elements(svg);
  for (const shape of shapes) {
    for (const key of coordinateKeys) if (shape[key] !== undefined) assert.ok(Number.isFinite(Number(shape[key])), `${shape.tag}.${key} is finite`);
  }
  const frame = shapes.find((shape) => shape.tag === "rect" && shape["data-opf-path"] === "slides.0.chart");
  assert.ok(frame, "real chart frame is present");
  return { shapes, frame };
}

const ranges = [
  ["ordinary", [1, 2, 4]],
  ["minimum-subnormal", [Number.MIN_VALUE, 2 * Number.MIN_VALUE, 4 * Number.MIN_VALUE]],
  ["subnormal", [1e-323, 2e-323, 4e-323]],
  ["maximum", [Number.MAX_VALUE / 4, Number.MAX_VALUE / 2, Number.MAX_VALUE]],
  ["mixed-extremes", [-Number.MAX_VALUE, 0, Number.MAX_VALUE]],
  ["negative-extremes", [-Number.MAX_VALUE, -Number.MAX_VALUE / 2, -Number.MAX_VALUE / 4]]
];
let rendered = 0;
for (const [name, values] of ranges) {
  for (const type of ["column", "bar", "line-with-markers", "area", "radar-with-markers", "scatter"]) {
    const data = type === "scatter"
      ? { columns: ["Category", "X", "Y"], rows: values.map((v, i) => [`point ${i}`, v, v]) }
      : { columns: ["Category", "Value"], rows: values.map((v, i) => [`point ${i}`, v]) };
    const { svg, error } = await render({ slides: [{ chart: { type, data } }] });
    assert.equal(error, undefined, `${type}/${name}: finite input renders`);
    const { shapes, frame } = finiteGeometry(svg);
    assert.match(svg, new RegExp(`data-opf-chart="${type}"`));
    assert.doesNotMatch(svg, /No chart data|No positive chart values/);
    const marks = shapes.filter((s) => type === "scatter" ? /^slides\.0\.chart\.data\.rows\.\d+\.2$/.test(s["data-opf-path"] ?? "") : pointPath.test(s["data-opf-path"] ?? ""));
    if (type === "column" || type === "bar") {
      assert.equal(marks.length, 3, `${type}/${name}: all three authored marks`);
      const extent = type === "column" ? "height" : "width";
      assert.ok(Math.max(...marks.map((m) => Number(m[extent]))) > 30, `${type}/${name}: meaningful data extent`);
      marks.forEach((m, i) => {
        assert.ok(Number(m.width) >= 0 && Number(m.height) >= 0);
        assert.equal(Number(m[extent]) > 0, values[i] !== 0, `${type}/${name}: only true zero has zero extent`);
        assert.ok(Number(m.x) >= Number(frame.x) && Number(m.y) >= Number(frame.y));
        assert.ok(Number(m.x) + Number(m.width) <= Number(frame.x) + Number(frame.width));
        assert.ok(Number(m.y) + Number(m.height) <= Number(frame.y) + Number(frame.height));
      });
      const largest = Math.max(...marks.map((m) => Number(m[extent])));
      const maxValue = Math.max(...values.map(Math.abs));
      marks.forEach((m, i) => assert.ok(Math.abs(Number(m[extent]) / largest - Math.abs(values[i]) / maxValue) < 0.001, `${type}/${name}: proportional magnitudes`));
    } else if (type === "area") {
      const area = shapes.find((s) => s.tag === "path" && s["data-opf-path"] === "slides.0.chart.data.columns.1");
      assert.ok(area?.d && / L /.test(area.d), `${type}/${name}: real area polygon`);
      const coordinates = area.d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
      assert.ok(coordinates.every(Number.isFinite));
      const ys = coordinates.filter((_, i) => i % 2 === 1);
      assert.ok(Math.max(...ys) - Math.min(...ys) > 30, `${type}/${name}: non-collapsed polygon`);
    } else {
      assert.equal(marks.length, 3, `${type}/${name}: all three authored points`);
      assert.ok(marks.every((m) => m.tag === "circle" && Number(m.r) > 0));
      assert.equal(new Set(marks.map((m) => `${m.cx},${m.cy}`)).size, 3, `${type}/${name}: distinct points`);
      if (type === "scatter") {
        assert.ok(Number(marks[0].cx) < Number(marks[1].cx) && Number(marks[1].cx) < Number(marks[2].cx));
        assert.ok(Number(marks[0].cy) > Number(marks[1].cy) && Number(marks[1].cy) > Number(marks[2].cy));
      }
    }
    assert.ok(shapes.some((s) => s.tag === "line" && Number(s["stroke-width"]) > 0), `${type}/${name}: visible axis/grid`);
    rendered++;
  }
}

// Aggregates outside the representable range are an explicit fidelity limit.
// Reject with an actionable path; never hang, invent zero, or emit invalid SVG.
const overflowTypes = ["stacked-column", "stacked-bar", "stacked-line", "stacked-area", "100pct-stacked-column", "100pct-stacked-area", "pie", "doughnut"];
for (const type of overflowTypes) {
  const circular = type === "pie" || type === "doughnut";
  const data = circular
    ? { columns: ["Category", "Value"], rows: [["A", Number.MAX_VALUE], ["B", Number.MAX_VALUE]] }
    : { columns: ["Category", "One", "Two"], rows: [["A", Number.MAX_VALUE, Number.MAX_VALUE]] };
  const { svg, error } = await render({ slides: [{ chart: { type, data } }] });
  assert.equal(svg, undefined);
  assert.equal(error?.name, "RangeError");
  assert.match(error.message, /Cannot render slides\.0\.chart: .* total exceeds the finite numeric range\. Rescale the chart values before rendering\./);
}
console.log(`Chart scales passed: ${rendered} public finite-value geometry cases; ${overflowTypes.length} explicit aggregate-overflow rejections.`);
