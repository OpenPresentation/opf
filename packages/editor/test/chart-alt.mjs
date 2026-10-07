// FA-09: Chart.alt in the editor. The chart options panel's alt field and "Decorative" box edit it as one validated, undoable
// patch; the Review panel's quick fix for audit/chart-text-alternative writes it; find and replace reaches it; the preview names the
// chart with it and the PPTX export carries it.
import assert from "node:assert/strict";
import { renderSvg } from "@openpresentation/opf-render/svg";
import * as pptx from "@openpresentation/opf-pptx";
import { createEditorSession } from "../dist/index.js";
import { prepareChartOptions, readChartOptions, setChartOptions } from "../dist/chart-options.js";
import { findMatches, replaceAll } from "../dist/find-replace.js";
import { altTextPatch, currentAltText, findingTarget, reviewFindings, runAudit, setReviewAltText } from "../dist/review.js";

const C = "slides.0.chart";
const data = { columns: ["Quarter", "Revenue"], rows: [["Q1", 10], ["Q2", 20]] };
const deck = (chart = {}) => ({
  name: "Chart alt fixture",
  language: "en-US",
  design: { theme: "minimal", fontScheme: "aptos" },
  slides: [{ id: "c", title: "Revenue", chart: { type: "column", data, ...chart } }],
});
const session = (chart) => createEditorSession(deck(chart), { rejectInvalid: true });

// Form state: absent, text and decorative are three different states.
assert.deepEqual([readChartOptions({ type: "column", data }).state.alt, readChartOptions({ type: "column", data }).state.decorative], ["", false]);
assert.deepEqual([readChartOptions({ type: "column", data, alt: "Up" }).state.alt, readChartOptions({ type: "column", data, alt: "Up" }).state.decorative], ["Up", false]);
assert.deepEqual([readChartOptions({ type: "column", data, alt: "" }).state.alt, readChartOptions({ type: "column", data, alt: "" }).state.decorative], ["", true]);

// Typing alt text is one undo step, the text is trimmed, an unchanged value is no change.
{
  const editor = session();
  const change = setChartOptions(editor, C, { alt: "  Revenue doubled from 10 in Q1 to 20 in Q2.  " });
  assert.equal(change.changed, true);
  assert.equal(editor.get(`${C}.alt`), "Revenue doubled from 10 in Q1 to 20 in Q2.");
  assert.equal(editor.snapshot().undoDepth, 1);
  assert.equal(setChartOptions(editor, C, { alt: "Revenue doubled from 10 in Q1 to 20 in Q2." }).changed, false);
  assert.match(renderSvg(editor.document), /role="img"/, "the preview names the chart");
  const bytes = await pptx.toPptx(structuredClone(editor.document), { strictAssets: true });
  const back = await pptx.fromPptx(bytes);
  assert.equal((back.slides[0].chart ?? back.slides[0].blocks.find((block) => block.chart).chart).alt, "Revenue doubled from 10 in Q1 to 20 in Q2.", "alt survives the PPTX round trip");
  // Emptying the field removes alt (the audit then asks for it again); it does not mark the chart decorative.
  setChartOptions(editor, C, { alt: "" });
  assert.equal(Object.hasOwn(editor.get(C), "alt"), false);
  editor.undo();
  assert.equal(editor.get(`${C}.alt`), "Revenue doubled from 10 in Q1 to 20 in Q2.");
}

// Decorative writes the empty alt and wins over typed text; unticking removes an empty alt but keeps real text.
{
  const editor = session();
  setChartOptions(editor, C, { decorative: true });
  assert.equal(editor.get(`${C}.alt`), "");
  assert.match(renderSvg(editor.document), /aria-hidden="true"/);
  setChartOptions(editor, C, { decorative: false });
  assert.equal(Object.hasOwn(editor.get(C), "alt"), false);
  const text = session({ alt: "Kept" });
  assert.equal(setChartOptions(text, C, { decorative: false }).changed, false);
  assert.equal(text.get(`${C}.alt`), "Kept");
  assert.equal(prepareChartOptions(deck({ alt: "x" }), C, { alt: "y", decorative: true }).document.slides[0].chart.alt, "");
}

// The Review panel's quick fix: audit/chart-text-alternative focuses the chart's alt field and the typed text lands on the chart.
{
  const editor = session();
  const finding = reviewFindings(runAudit(editor.document)).find((entry) => entry.ruleId === "audit/chart-text-alternative");
  assert.ok(finding, "a chart with no alt and nothing beside it is a finding");
  const focus = finding.fixes.find((fix) => fix.kind === "focus" && fix.focus.field === "alt");
  assert.equal(focus.focus.path, "/slides/0/chart");
  assert.equal(currentAltText(editor.document, focus.focus.path), "");
  assert.deepEqual(altTextPatch(editor.document, focus.focus.path, "Revenue doubled."), [{ op: "add", path: "/slides/0/chart/alt", value: "Revenue doubled." }]);
  assert.equal(findingTarget(editor.document, finding).exact, true);
  setReviewAltText(editor, focus.focus.path, "Revenue doubled from 10 to 20.");
  assert.equal(editor.get(`${C}.alt`), "Revenue doubled from 10 to 20.");
  assert.equal(reviewFindings(runAudit(editor.document)).some((entry) => entry.ruleId === "audit/chart-text-alternative"), false, "the finding is gone");
}

// Find and replace reaches chart alt text, as it does image alt text.
{
  const editor = session({ alt: "Revenue doubled in Q2" });
  const matches = findMatches(editor.document, "Q2").matches;
  assert.ok(matches.some((match) => match.label?.includes("Chart alt text")), "found in the chart alt text");
  replaceAll(editor, "Q2", "Q3");
  assert.equal(editor.get(`${C}.alt`), "Revenue doubled in Q3");
}

console.log("chart alt: editor field, undo, review fix, find and replace");
