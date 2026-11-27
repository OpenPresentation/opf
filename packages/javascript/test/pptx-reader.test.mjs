// NT-09: `reader` of the pptx export reaches opf-pptx's toPptx, which owns the option set it stands for (readerOptions). It applies
// to pptx only, is refused with `as: "images"` like `typefaces`, and an opf-pptx without readerOptions is refused. The note on
// families that are not Office-safe follows the typefaces in effect: none for the keynote set, one when `typefaces` overrides it.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { OPFApiError, Reporter, resolveExportOptions, runExport } from "../dist/node-engine.js";

const deck = { name: "Reader", slides: [{ title: "A title" }] };
const KEYNOTE = { typefaces: "safe", slideNumberFields: "static" };
const spy = ({ reader = true } = {}) => {
  const calls = [];
  const module = {
    toPptx: async (_presentation, options) => {
      calls.push(options);
      return new Uint8Array([80, 75]);
    },
    fromPptx: async () => ({}),
    typefacesNotOfficeSafe: () => ["Aptos"],
    ...(reader ? { readerOptions: (name) => (name === "keynote" ? { ...KEYNOTE } : {}) } : {}),
  };
  return { peer: { module, version: "0.37.0", name: "@openpresentation/opf-pptx" }, calls };
};
const exportWith = async (options, peer, flags = false) => {
  const reporter = new Reporter();
  await runExport(deck, resolveExportOptions({ format: "pptx", ...options }), { reporter, pptx: peer, flags });
  return reporter.findings;
};
const noted = (findings) => findings.some((finding) => finding.ruleId === "pptx/typeface-not-office-safe");

describe("pptx reader", () => {
  test("reaches toPptx as reader, beside the options given, and the default passes none", async () => {
    const { peer, calls } = spy();
    const plain = await exportWith({}, peer);
    assert.equal("reader" in calls[0], false);
    assert.equal(noted(plain), true);
    const keynote = await exportWith({ reader: "keynote" }, peer);
    assert.equal(calls[1].reader, "keynote");
    assert.equal("typefaces" in calls[1], false, "opf-pptx applies the set, not core");
    assert.equal(noted(keynote), false, "the keynote set writes safe typefaces");
    const selected = await exportWith({ reader: "keynote", typefaces: "selected", slideNumbers: "live" }, peer);
    assert.deepEqual([calls[2].reader, calls[2].typefaces, calls[2].slideNumberFields], ["keynote", "selected", "live"]);
    assert.equal(noted(selected), true, "typefaces given beside the reader wins, and its note follows");
    const note = selected.find((finding) => finding.ruleId === "pptx/typeface-not-office-safe");
    assert.match(note.help, /--reader keynote/);
    const powerpoint = await exportWith({ reader: "powerpoint" }, peer);
    assert.equal(calls[3].reader, "powerpoint");
    assert.equal(noted(powerpoint), true);
  });

  test("other values, other formats and as images are invalid", () => {
    assert.throws(() => resolveExportOptions({ format: "pptx", reader: "impress" }), /reader must be one of: powerpoint, keynote/);
    assert.throws(() => resolveExportOptions({ format: "pdf", reader: "keynote" }), /reader and as apply to format pptx/);
    assert.throws(() => resolveExportOptions({ format: "pptx", as: "images", reader: "keynote" }), /reader do not apply to as: "images"/);
    assert.throws(() => resolveExportOptions({ format: "pptx", as: "images", reader: "powerpoint" }), /reader do not apply to as: "images"/);
  });

  test("an opf-pptx without readerOptions is refused, naming the option or the flag", async () => {
    await assert.rejects(exportWith({ reader: "keynote" }, spy({ reader: false }).peer), (error) => error instanceof OPFApiError && error.code === "peer-too-old" && /reader: "keynote" needs a newer/.test(error.message));
    await assert.rejects(exportWith({ reader: "keynote" }, spy({ reader: false }).peer, true), (error) => error instanceof OPFApiError && /--reader keynote needs a newer/.test(error.message));
    const { peer, calls } = spy({ reader: false });
    await exportWith({}, peer);
    assert.equal(calls.length, 1, "the default export runs on it");
  });
});
