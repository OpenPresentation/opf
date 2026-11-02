// LH-28 / LH-20: `typefaces` and `as` of the pptx export reach opf-pptx's toPptx; `as: "images"` hands it a slide rasterizer that draws
// with the export's renderer, fonts and image resolver; a normal export notes the families that are not Office-safe.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { OPFApiError, Reporter, resolveExportOptions, runExport } from "../dist/node-engine.js";

const deck = { name: "Typefaces", slides: [{ title: "A title" }] };
const spy = ({ typefaces = true, rasterize = false } = {}) => {
  const calls = [];
  const module = {
    toPptx: async (presentation, options) => {
      calls.push(options);
      if (rasterize) calls.png = await options.slideRasterizer(presentation, 1, { scale: options.scale });
      return new Uint8Array([80, 75]);
    },
    fromPptx: async () => ({}),
    inventoryTypefaces: () => [],
    ...(typefaces ? { typefacesNotOfficeSafe: () => ["Aptos", "Aptos Display"] } : {}),
  };
  return { peer: { module, version: "0.31.0", name: "@openpresentation/opf-pptx" }, calls };
};
const exportWith = async (options, peer, flags = false) => {
  const reporter = new Reporter();
  await runExport(deck, resolveExportOptions({ format: "pptx", ...options }), { reporter, pptx: peer, flags });
  return reporter.findings;
};

describe("pptx typefaces", () => {
  test("the default notes the families a viewer may substitute; safe mode reaches toPptx and needs no note", async () => {
    const { peer, calls } = spy();
    const plain = await exportWith({}, peer);
    assert.equal("typefaces" in calls[0], false);
    assert.deepEqual(
      plain.filter((finding) => finding.ruleId === "pptx/typeface-not-office-safe").map((finding) => [finding.severity, finding.families]),
      [["info", ["Aptos", "Aptos Display"]]],
    );
    const safe = await exportWith({ typefaces: "safe" }, peer);
    assert.equal(calls[1].typefaces, "safe");
    assert.equal(safe.some((finding) => finding.ruleId === "pptx/typeface-not-office-safe"), false);
  });

  test("an opf-pptx that predates it is refused, and other values or formats are invalid", async () => {
    await assert.rejects(exportWith({ typefaces: "safe" }, spy({ typefaces: false }).peer), (error) => error instanceof OPFApiError && error.code === "peer-too-old");
    // Without the function the default export still runs, with no note.
    assert.deepEqual(await exportWith({}, spy({ typefaces: false }).peer), []);
    assert.throws(() => resolveExportOptions({ format: "pptx", typefaces: "office" }), /typefaces must be one of: selected, safe/);
    assert.throws(() => resolveExportOptions({ format: "png", typefaces: "safe" }), /apply to format pptx/);
  });
});

describe("pptx as images", () => {
  test("toPptx gets as, the picture scale and a rasterizer that draws the slide with the export's renderer", async () => {
    const { peer, calls } = spy({ rasterize: true });
    const findings = await exportWith({ as: "images", scale: 0.25 }, peer);
    assert.equal(calls[0].as, "images");
    assert.equal(calls[0].scale, 0.25);
    assert.deepEqual([...calls.png.subarray(1, 4)], [0x50, 0x4e, 0x47], "a PNG");
    assert.equal(new DataView(calls.png.buffer, calls.png.byteOffset).getUint32(16), 320, "1280 x 0.25 pixels wide");
    assert.equal(findings.some((finding) => finding.ruleId === "pptx/typeface-not-office-safe"), false, "pictures name no fonts");
    const { peer: second, calls: defaults } = spy();
    await exportWith({ as: "images" }, second);
    assert.equal(defaults[0].scale, 2, "2 by default");
  });

  test("the options that shape text, charts and records do not apply, and scale needs as images", () => {
    assert.throws(() => resolveExportOptions({ format: "pptx", as: "images", bodyText: "native" }), /do not apply to as: "images"/);
    assert.throws(() => resolveExportOptions({ format: "pptx", as: "images", typefaces: "safe" }), /do not apply to as: "images"/);
    assert.throws(() => resolveExportOptions({ format: "pptx", scale: 2 }), /scale applies to format png/);
    assert.throws(() => resolveExportOptions({ format: "pptx", as: "pictures" }), /as must be one of: native, images/);
  });
});
