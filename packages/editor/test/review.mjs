import assert from "node:assert/strict";
import { createEditorSession } from "../src/index.js";
import {
  altTextPatch,
  applyReviewFix,
  auditAvailable,
  countFindings,
  currentAltText,
  filterFindings,
  findingTarget,
  markDecorative,
  reviewFindings,
  runAudit,
  setReviewAltText,
} from "../src/review.js";

// RR-29: the headless model behind the Review panel (the DOM panel is covered by test/review-panel-browser.mjs).
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

ok(auditAvailable(), "core ships the audit");
const editor = createEditorSession(source());
const report = runAudit(editor.document);
ok(report.documentValid && Array.isArray(report.diagnostics), "runAudit returns core's report");
const findings = reviewFindings(report);
ok(findings.length >= 5, "the fixture has findings");
eq(new Set(findings.map((f) => f.id)).size, findings.length, "finding ids are unique within a report");
const find = (rule, path) => findings.find((f) => f.ruleId === `audit/${rule}` && (path === undefined || f.path === path));

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
eq(findingTarget(editor.document, contrast), { slide: 0, path: "slides.0.text.0.color", pointer: "/slides/0/text/0/color", exact: true });
const noTitle = find("missing-slide-title");
eq(noTitle.path, "/slides/2");
eq(findingTarget(editor.document, { path: "/slides/2/title" }), { slide: 2, path: "slides.2", pointer: "/slides/2", exact: false }, "a missing field points at its parent");
eq(findingTarget(editor.document, { path: "" }), { slide: null, path: "", pointer: "", exact: true });
eq(findingTarget(editor.document, { path: "/design/logo" }).slide, null);

// the contrast quick fix is one undoable, validated edit
const fix = contrast.fixes.find((f) => f.id === "use-readable-color");
ok(fix.safe && fix.kind === "patch");
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
ok(!runAudit(editor.document).diagnostics.some((d) => d.ruleId === "audit/text-contrast"), "the finding is gone after the fix");
editor.undo();

// stale findings and unsafe patches are refused
const stale = createEditorSession(source());
stale.set("slides.0.text", "plain now");
throwsCode(() => applyReviewFix(stale, contrast, fix), "stale-finding");
eq(stale.get("slides.0.text"), "plain now", "a stale fix changes nothing");
throwsCode(() => applyReviewFix(editor, contrast, { id: "x", kind: "patch", safe: true, patch: [{ op: "replace", path: "/", value: {} }] }), "invalid-fix");
throwsCode(() => applyReviewFix(editor, contrast, { id: "x", kind: "patch", safe: true, patch: [{ op: "move", path: "/name", from: "/x" }] }), "invalid-fix");
throwsCode(() => applyReviewFix(editor, contrast, { id: "x", kind: "patch", safe: true, patch: [] }), "invalid-fix");
throwsCode(() => applyReviewFix(editor, contrast, { id: "x", kind: "focus", safe: true, focus: { path: "/x", field: "alt" } }), "invalid-fix");
throwsCode(() => applyReviewFix(editor, contrast, { id: "x", kind: "patch", safe: true, patch: [{ op: "replace", path: "/slides/0/title", value: 42 }] }), "invalid-opf-edit");
eq(editor.get("slides.0.title"), "Revenue", "an edit that would make the document invalid is rejected");

// alt text: inline objects, bare strings, the registry, decorative, undo
const alt = createEditorSession(source());
eq(altTextPatch(alt.document, "/slides/1/blocks/0/image", "A chart"), [{ op: "replace", path: "/slides/1/blocks/0/image", value: { src: "https://example.com/one.png", alt: "A chart" } }]);
eq(altTextPatch(alt.document, "/slides/1/blocks/1/image", "Two"), [{ op: "add", path: "/slides/1/blocks/1/image/alt", value: "Two" }]);
setReviewAltText(alt, "/slides/1/blocks/0/image", "  The sales chart  ");
eq(alt.get("slides.1.blocks.0.image"), { src: "https://example.com/one.png", alt: "The sales chart" });
eq(currentAltText(alt.document, "/slides/1/blocks/0/image"), "The sales chart");
setReviewAltText(alt, "/slides/1/blocks/0/image", "The sales chart, revised");
eq(alt.get("slides.1.blocks.0.image.alt"), "The sales chart, revised");
eq(setReviewAltText(alt, "/slides/1/blocks/0/image", "The sales chart, revised").changed, false, "no change, no history entry");
throwsCode(() => setReviewAltText(alt, "/slides/1/blocks/1/image", "   "), "empty-alt-text");
throwsCode(() => setReviewAltText(alt, "/slides/9/image", "x"), "stale-finding");
// a registry reference gets its alt text on the asset, so every use has it
setReviewAltText(alt, "/slides/3/image", "The team");
eq(alt.get("assets.hero"), { src: "https://example.com/hero.jpg", alt: "The team" });
eq(alt.get("slides.3.image"), "asset:hero", "the reference itself is untouched");
eq(currentAltText(alt.document, "/slides/3/image"), "The team");
ok(!runAudit(alt.document).diagnostics.some((d) => d.ruleId === "audit/missing-alt-text" && d.path === "/slides/3/image"));
alt.undo();
eq(alt.get("assets.hero"), { src: "https://example.com/hero.jpg" });
// decorative is an explicit empty alt, and it satisfies the audit
markDecorative(alt, "/slides/1/blocks/1/image");
eq(alt.get("slides.1.blocks.1.image.alt"), "");
ok(!runAudit(alt.document).diagnostics.some((d) => d.ruleId === "audit/missing-alt-text" && d.path === "/slides/1/blocks/1/image"));
markDecorative(alt, "/slides/3/image");
eq(alt.get("assets.hero.alt"), "");
const plainAsset = createEditorSession({ ...source(), slides: [{ title: "P", image: "asset:plain" }] });
markDecorative(plainAsset, "/slides/0/image");
eq(plainAsset.get("assets.plain"), { src: "https://example.com/plain.jpg", alt: "" });
eq(markDecorative(plainAsset, "/slides/0/image").changed, false);
// the audit's own fixes apply
const missing = reviewFindings(runAudit(createEditorSession(source()).document)).find((f) => f.ruleId === "audit/missing-alt-text" && f.path === "/slides/1/blocks/0/image");
const decorative = missing.fixes.find((f) => f.id === "mark-decorative");
ok(!decorative.safe && decorative.kind === "patch");
const viaFix = createEditorSession(source());
applyReviewFix(viaFix, missing, decorative);
eq(viaFix.get("slides.1.blocks.0.image"), { src: "https://example.com/one.png", alt: "" });
eq(missing.fixes[0].focus, { path: "/slides/1/blocks/0/image", field: "alt", value: "https://example.com/one.png" });

// an injected audit function and unavailable audits
eq(runAudit({ x: 1 }, { audit: (document, options) => ({ diagnostics: [], got: [document, options] }) }).got, [{ x: 1 }, {}]);
throwsCode(() => runAudit({}, { audit: 3 }), "audit-unavailable");
eq(reviewFindings(undefined), []);

// audit options reach core (severity per rule)
const strict = reviewFindings(runAudit(editor.document, { rules: { "text-contrast": "error" } })).find((f) => f.ruleId === "audit/text-contrast");
eq(strict.severity, "error");

console.log(`Review model passed ${checks} checks.`);
