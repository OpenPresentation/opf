import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../src/index.js";
import {
  CORE_SOURCE,
  altTextPatch,
  applyReviewFix,
  countFindings,
  currentAltText,
  filterFindings,
  findingTarget,
  groupFindings,
  markDecorative,
  mergeFindingReports,
  reviewCategories,
  reviewFindings,
  setReviewAltText,
  sortFindings,
} from "../src/review.js";

// RR-29, RR-55: the headless model behind the Review panel (the DOM panel is covered by test/review-panel-browser.mjs). The findings are
// core's `validate(presentation)`; a hosted reviewer's `FindingReport` merges in by `Finding.source`.
const white = { background: { type: "solid", color: "#FFFFFF" } };
const source = () => ({
  name: "Review",
  language: "en-US",
  design: white,
  assets: { hero: { src: "https://example.com/hero.jpg" }, plain: "https://example.com/plain.jpg" },
  slides: [
    { id: "a", title: "Revenue", text: [{ text: "faint", color: "#CCCCCC" }, " and normal"] },
    { id: "b", title: "Pictures", blocks: [{ image: "https://example.com/one.png" }, { image: { src: "https://example.com/two.png" } }] },
    { id: "c", text: "No title here" },
    { id: "d", title: "Registry", image: "asset:hero" },
  ],
});
let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const throwsCode = (fn, code) => {
  try { fn(); } catch (error) { eq(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`); return; }
  assert.fail(`expected ${code}`);
};

const editor = createEditorSession(source());
const report = validate(editor.presentation);
ok(report.valid && report.schemaValid && Array.isArray(report.findings), "validate returns core's report");
const findings = reviewFindings(report);
ok(findings.length >= 5, "the fixture has findings");
eq(new Set(findings.map((f) => f.id)).size, findings.length, "finding ids are unique within a report");
const find = (rule, path) => findings.find((f) => f.ruleId === `opf/${rule}` && (path === undefined || f.path === path));

// counts and filters
const counts = countFindings(findings);
eq(counts.total, findings.length);
eq(counts.error + counts.warning + counts.info, counts.total);
ok(filterFindings(findings, { minimum: "warning" }).every((f) => f.severity !== "info"));
ok(filterFindings(findings, { slide: 0 }).every((f) => f.slide === 0));
ok(filterFindings(findings, { slide: null }).every((f) => f.slide === null), "deck findings have slide null");
ok(filterFindings(findings, { minimum: "error" }).length === counts.error);

// targets: the slide and the deepest existing path
const contrast = find("text-contrast");
eq(contrast.slide, 0);
eq(contrast.dottedPath, "slides.0.text.0.color");
eq(findingTarget(editor.presentation, contrast), { slide: 0, path: "slides.0.text.0.color", pointer: "/slides/0/text/0/color", exact: true });
const noTitle = find("missing-slide-title");
eq(noTitle.path, "/slides/2");
eq(findingTarget(editor.presentation, { path: "/slides/2/title" }), { slide: 2, path: "slides.2", pointer: "/slides/2", exact: false }, "a missing field points at its parent");
eq(findingTarget(editor.presentation, { path: "" }), { slide: null, path: "", pointer: "", exact: true });
eq(findingTarget(editor.presentation, { path: "/design/logo" }).slide, null);

// the contrast quick fix is one undoable, validated edit
const fix = contrast.fixes.find((f) => f.id === "use-readable-color");
ok(fix.safe && fix.kind === "patch" && fix.title === "Use the slide text colour", "a core fix has a title and an RFC 6902 patch");
const events = [];
const stop = editor.subscribe((event) => events.push(event.type));
const change = applyReviewFix(editor, contrast, fix);
eq(editor.get("slides.0.text.0.color"), "text");
eq(change.patches, [{ op: "replace", path: "/slides/0/text/0/color", value: "text" }]);
eq(events, ["patch"]);
ok(editor.canUndo);
editor.undo();
eq(editor.get("slides.0.text.0.color"), "#CCCCCC", "undo restores the colour");
eq(events, ["patch", "undo"]);
stop();
applyReviewFix(editor, contrast, fix);
ok(!validate(editor.presentation).findings.some((d) => d.ruleId === "opf/text-contrast"), "the finding is gone after the fix");
editor.undo();

// stale findings and unsafe patches are refused
const stale = createEditorSession(source());
stale.set("slides.0.text", "plain now");
throwsCode(() => applyReviewFix(stale, contrast, fix), "stale-finding");
eq(stale.get("slides.0.text"), "plain now", "a stale fix changes nothing");
throwsCode(() => applyReviewFix(editor, contrast, { id: "x", kind: "patch", safe: true, patch: [{ op: "replace", path: "/", value: {} }] }), "invalid-fix");
throwsCode(() => applyReviewFix(editor, contrast, { id: "x", kind: "patch", safe: true, patch: [{ op: "move", path: "/name", from: "/x" }] }), "stale-finding");
throwsCode(() => applyReviewFix(editor, contrast, { id: "x", kind: "patch", safe: true, patch: [] }), "invalid-fix");
throwsCode(() => applyReviewFix(editor, contrast, { id: "x", kind: "focus", safe: true, focus: { path: "/x", field: "alt" } }), "invalid-fix");
throwsCode(() => applyReviewFix(editor, contrast, { id: "x", kind: "patch", safe: true, patch: [{ op: "replace", path: "/slides/0/title", value: 42 }] }), "invalid-opf-edit");
eq(editor.get("slides.0.title"), "Revenue", "an edit that would make the document invalid is rejected");

// alt text: inline objects, bare strings, the registry, decorative, undo
const alt = createEditorSession(source());
eq(altTextPatch(alt.presentation, "/slides/1/blocks/0/image", "A chart"), [{ op: "replace", path: "/slides/1/blocks/0/image", value: { src: "https://example.com/one.png", alt: "A chart" } }]);
eq(altTextPatch(alt.presentation, "/slides/1/blocks/1/image", "Two"), [{ op: "add", path: "/slides/1/blocks/1/image/alt", value: "Two" }]);
setReviewAltText(alt, "/slides/1/blocks/0/image", "  The sales chart  ");
eq(alt.get("slides.1.blocks.0.image"), { src: "https://example.com/one.png", alt: "The sales chart" });
eq(currentAltText(alt.presentation, "/slides/1/blocks/0/image"), "The sales chart");
setReviewAltText(alt, "/slides/1/blocks/0/image", "The sales chart, revised");
eq(alt.get("slides.1.blocks.0.image.alt"), "The sales chart, revised");
eq(setReviewAltText(alt, "/slides/1/blocks/0/image", "The sales chart, revised").changed, false, "no change, no history entry");
throwsCode(() => setReviewAltText(alt, "/slides/1/blocks/1/image", "   "), "empty-alt-text");
throwsCode(() => setReviewAltText(alt, "/slides/9/image", "x"), "stale-finding");
// a registry reference gets its alt text on the asset, so every use has it
setReviewAltText(alt, "/slides/3/image", "The team");
eq(alt.get("assets.hero"), { src: "https://example.com/hero.jpg", alt: "The team" });
eq(alt.get("slides.3.image"), "asset:hero", "the reference itself is untouched");
eq(currentAltText(alt.presentation, "/slides/3/image"), "The team");
ok(!validate(alt.presentation).findings.some((d) => d.ruleId === "opf/missing-alt-text" && d.path === "/slides/3/image"));
alt.undo();
eq(alt.get("assets.hero"), { src: "https://example.com/hero.jpg" });
// decorative is an explicit empty alt, and it satisfies the audit
markDecorative(alt, "/slides/1/blocks/1/image");
eq(alt.get("slides.1.blocks.1.image.alt"), "");
ok(!validate(alt.presentation).findings.some((d) => d.ruleId === "opf/missing-alt-text" && d.path === "/slides/1/blocks/1/image"));
markDecorative(alt, "/slides/3/image");
eq(alt.get("assets.hero.alt"), "");
const plainAsset = createEditorSession({ ...source(), slides: [{ title: "P", image: "asset:plain" }] });
markDecorative(plainAsset, "/slides/0/image");
eq(plainAsset.get("assets.plain"), { src: "https://example.com/plain.jpg", alt: "" });
eq(markDecorative(plainAsset, "/slides/0/image").changed, false);
// the audit's own fixes apply
const missing = reviewFindings(validate(createEditorSession(source()).presentation)).find((f) => f.ruleId === "opf/missing-alt-text" && f.path === "/slides/1/blocks/0/image");
const decorative = missing.fixes.find((f) => f.id === "mark-decorative");
ok(!decorative.safe && decorative.kind === "patch");
const viaFix = createEditorSession(source());
applyReviewFix(viaFix, missing, decorative);
eq(viaFix.get("slides.1.blocks.0.image"), { src: "https://example.com/one.png", alt: "" });
eq(missing.fixes[0].focus, { path: "/slides/1/blocks/0/image", field: "alt", value: "https://example.com/one.png" });

// every other fix of core's patches is applied as it is: all RFC 6902 operations, below the root, and a stale target is refused
{
  const moved = createEditorSession(source());
  applyReviewFix(moved, undefined, { title: "Rename", patch: [{ op: "test", path: "/name", value: "Review" }, { op: "copy", from: "/name", path: "/description" }, { op: "replace", path: "/name", value: "Reviewed" }] });
  eq([moved.get("name"), moved.get("description")], ["Reviewed", "Review"], "a fix with no kind is a patch fix; test and copy operations apply");
  throwsCode(() => applyReviewFix(moved, undefined, { title: "x", patch: [{ op: "move", from: "/nothing", path: "/other" }] }), "stale-finding");
}

// the hook's findings and core's merge by source, and neither overwrites the other
{
  eq(reviewFindings(undefined), []);
  const core = validate(editor.presentation);
  const hosted = {
    valid: true,
    counts: { error: 0, warning: 1, info: 1 },
    findings: [
      { ruleId: "pptx.dev/narrative-gap", source: "pptx.dev/review", severity: "warning", category: "narrative", path: "/slides/1", message: "Slide 2 does not say what to do." },
      { ruleId: "pptx.dev/audience-fit", source: "pptx.dev/review", severity: "info", category: "audience-fit", path: "", message: "Too much jargon for this audience." },
    ],
  };
  const merged = mergeFindingReports(core, hosted);
  eq(merged.sources, [CORE_SOURCE, "pptx.dev/review"]);
  eq(merged.findings.length, core.findings.length + 2, "every finding of both sources is kept");
  eq(merged.counts.warning, core.counts.warning + 1);
  ok(merged.valid, "valid follows the error count");
  // A second hosted run replaces that source's earlier findings only.
  const rerun = mergeFindingReports(merged, { ...hosted, findings: hosted.findings.slice(0, 1) });
  eq(rerun.findings.filter((f) => f.source === "pptx.dev/review").length, 1);
  eq(rerun.findings.filter((f) => (f.source ?? CORE_SOURCE) === CORE_SOURCE).length, core.findings.length);
  // A hook finding with no source cannot pass for one of core's.
  const unnamed = mergeFindingReports(core, { findings: [{ ruleId: "house/title-case", severity: "error", category: "policy", path: "/slides/0/title", message: "Use title case." }] });
  eq(unnamed.findings.at(-1).source, "review");
  ok(!unnamed.valid, "a hosted error makes the merged report invalid");
  // Editor fields: unique ids per source, the slide, the dotted path.
  const listed = reviewFindings(merged);
  eq(new Set(listed.map((f) => f.id)).size, listed.length);
  const gap = listed.find((f) => f.ruleId === "pptx.dev/narrative-gap");
  eq([gap.slide, gap.dottedPath, gap.source], [1, "slides.1", "pptx.dev/review"]);
  eq(listed.find((f) => f.ruleId === "pptx.dev/audience-fit").slide, null);
  // Grouped by category: core's categories first in core's order, then the hosted ones as they appear.
  const groups = groupFindings(listed);
  const names = groups.map((group) => group.category);
  eq(names, [...reviewCategories.filter((category) => names.includes(category)), "narrative", "audience-fit"]);
  ok(groups.every((group) => group.findings.every((f) => f.category === group.category)));
  const sorted = sortFindings(listed);
  const rank = { error: 3, warning: 2, info: 1 };
  ok(sorted.every((f, i) => i === 0 || (sorted[i - 1].slide ?? -1) < (f.slide ?? -1) || ((sorted[i - 1].slide ?? -1) === (f.slide ?? -1) && rank[sorted[i - 1].severity] >= rank[f.severity])), "findings are in reading order: slide, then severity");
  // A hosted fix applies like a core fix: one undoable edit.
  const hostedFix = { title: "Add a call to action", patch: [{ op: "add", path: "/slides/1/subtitle", value: "Decide by Friday" }] };
  const session = createEditorSession(source());
  const change = applyReviewFix(session, gap, hostedFix);
  eq(change.patches, [{ op: "add", path: "/slides/1/subtitle", value: "Decide by Friday" }]);
  session.undo();
  eq(session.get("slides.1.subtitle"), undefined);
}

// validate options reach core (severity per rule); an authored error severity makes the report invalid
const strict = validate(editor.presentation, { severity: { "opf/text-contrast": "error" } });
eq(strict.findings.find((f) => f.ruleId === "opf/text-contrast").severity, "error");
ok(!strict.valid);

console.log(`Review model passed ${checks} checks.`);
