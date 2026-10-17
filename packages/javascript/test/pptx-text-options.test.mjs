// RR-88 / RR-91: `bodyText` and `slideNumbers` of the pptx export reach opf-pptx's toPptx as `bodyText` and `slideNumberFields`,
// apply to pptx output only, and are refused (not ignored) by an opf-pptx that predates them.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { OPFApiError, Reporter, resolveExportOptions, runExport } from "../dist/node-engine.js";

const deck = { name: "Text options", slides: [{ title: "A title" }] };
const spy = (version) => {
  const calls = [];
  const module = {
    toPptx: async (presentation, options) => {
      calls.push(options);
      return new Uint8Array([80, 75]);
    },
    fromPptx: async () => ({}),
    inventoryTypefaces: () => [],
  };
  return { peer: { module, version, name: "@openpresentation/opf-pptx" }, calls };
};
const exportWith = (options, peer, flags = false) => runExport(deck, resolveExportOptions({ format: "pptx", ...options }), { reporter: new Reporter(), pptx: peer, flags });

describe("pptx text options", () => {
  test("bodyText and slideNumbers are handed to toPptx under opf-pptx's option names", async () => {
    const { peer, calls } = spy("0.21.0");
    await exportWith({ bodyText: "native", slideNumbers: "static" }, peer);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].bodyText, "native");
    assert.equal(calls[0].slideNumberFields, "static");
    await exportWith({ slideNumbers: "live" }, peer);
    assert.equal(calls[1].slideNumberFields, "live");
    assert.equal("bodyText" in calls[1], false);
  });

  test("without the options toPptx is called as before", async () => {
    const { peer, calls } = spy("0.21.0");
    await exportWith({}, peer);
    assert.equal("bodyText" in calls[0] || "slideNumberFields" in calls[0], false);
  });

  test("other values are invalid, and the options apply to pptx only", () => {
    assert.throws(() => resolveExportOptions({ format: "pptx", bodyText: "wrapped" }), { code: "invalid-option", message: /bodyText must be one of: measured, native/ });
    assert.throws(() => resolveExportOptions({ format: "pptx", slideNumbers: "field" }), { code: "invalid-option", message: /slideNumbers must be one of: static, live/ });
    for (const format of ["svg", "png", "pdf"]) {
      assert.throws(() => resolveExportOptions({ format, bodyText: "native" }), { code: "invalid-option", message: /apply to format pptx/ });
      assert.throws(() => resolveExportOptions({ format, slideNumbers: "static" }), { code: "invalid-option", message: /apply to format pptx/ });
    }
  });

  test("an opf-pptx that predates them is refused, naming the flag, instead of ignoring it", async () => {
    const { peer, calls } = spy("0.20.4");
    await assert.rejects(exportWith({ bodyText: "native" }, peer, true), (error) => error instanceof OPFApiError && error.code === "peer-too-old" && /--body-text native needs @openpresentation\/opf-pptx@0\.21\.0 or later; 0\.20\.4/.test(error.message));
    await assert.rejects(exportWith({ slideNumbers: "live" }, peer), { code: "peer-too-old", message: /slideNumbers needs/ });
    assert.equal(calls.length, 0);
    // measured is the default, so an older opf-pptx still serves it.
    await exportWith({ bodyText: "measured" }, peer);
    assert.equal(calls.length, 1);
  });
});
