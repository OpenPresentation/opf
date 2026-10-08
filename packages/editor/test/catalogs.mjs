// FA-23 (OPF 0.15): the editor takes catalogs from its host. One merged list reaches core, the pickers write the reference
// core gives, saving embeds, paste copies records with core's copySlides, "Update from catalog" applies only what was
// approved, and the reference findings are surfaced. The library imports no catalog data.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { validate } from "@openpresentation/opf";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import {
  OPFEditorError,
  applyCatalogUpdate,
  checkCatalogUpdates,
  createEditorSession,
  getCatalogOptions,
  mergeCatalogs,
  moveToCustom,
  catalogRecordAt,
  prepareSave,
  referenceFindings,
  saveDocument,
  setCatalogId,
} from "../dist/index.js";
import { listSwitchOptions, switchDimension } from "../dist/switches.js";
import { prepareOpfImport, parseOpfTransfer, serializeOpfTransfer } from "../dist/transfer.js";

const ACME = "pkg:@acme/opf-catalog";
const acme = (revision = 1) => ({
  source: ACME,
  themes: { brand: { name: "Acme brand", colorScheme: "ocean", fontScheme: "inter" } },
  colorSchemes: {
    ocean: {
      name: "Ocean",
      dark1: "#0B1F33", light1: "#FFFFFF", dark2: "#12324F", light2: "#E6F0F8",
      accent1: revision === 1 ? "#0077B6" : "#005F8F", accent2: "#00B4D8", accent3: "#90E0EF", accent4: "#F4A261", accent5: "#E76F51", accent6: "#2A9D8F",
      hyperlink: "#0077B6", followedHyperlink: "#5A189A",
    },
  },
  fontSchemes: { inter: { name: "Inter", major: "Inter", minor: "Inter" } },
  layouts: { hero: { name: "Acme hero", placeholders: [{ type: "title" }, { type: "text" }] } },
});

// --- mergeCatalogs: one list, the first catalog per source wins, the host default never moves --------------------
{
  const first = acme(1), second = acme(2);
  const merged = mergeCatalogs([defaultCatalog, first], undefined, [second], first);
  assert.deepEqual(merged.map((catalog) => catalog.source), [defaultCatalog.source, ACME]);
  assert.equal(merged[1], first, "the earlier catalog with a source wins");
  assert.ok(Object.isFrozen(merged));
  assert.throws(() => mergeCatalogs([{ layouts: {} }]), (error) => error instanceof OPFEditorError && error.code === "invalid-catalogs");
}

// --- the session's registration, setCatalogs and validation against the registered list ---------------------------
{
  const doc = { design: { theme: "acme:brand" }, catalogs: { acme: { source: ACME } }, slides: [{ layout: "acme:hero", title: "Hello" }] };
  const bare = createEditorSession(doc);
  assert.deepEqual(bare.catalogs, []);
  const unresolved = referenceFindings(bare.validation);
  assert.ok(unresolved.some((finding) => finding.ruleId === "opf/unresolved-reference" && finding.path.includes("layout")), "an unregistered acme:hero is reported");
  assert.equal(bare.validation.valid, true, "an unresolved reference is a warning, not an error");
  const events = [];
  bare.subscribe((event) => events.push(event.type));
  bare.setCatalogs([acme()]);
  assert.deepEqual(events, ["catalogs"]);
  assert.deepEqual(referenceFindings(bare.validation), [], "registering acme resolves both references");
  assert.deepEqual(bare.presentation, doc, "registering catalogs never changes the document");

  const undeclared = createEditorSession({ slides: [{ layout: "foo:hero", title: "x" }] });
  const undeclaredFindings = referenceFindings(undeclared.validation).filter((finding) => finding.ruleId === "opf/undeclared-catalog");
  assert.equal(undeclaredFindings.length, 1, "one finding per path");
  assert.equal(undeclaredFindings[0].severity, "error");
  assert.equal(undeclared.validation.valid, false, "an undeclared prefix makes the document invalid (a format error)");
  // A strict session refuses an edit that introduces one; the document is unchanged.
  const strict = createEditorSession({ slides: [{ title: "x" }] }, { rejectInvalid: true });
  assert.throws(() => strict.set("slides.0.layout", "foo:hero"), (error) => error.code === "invalid-opf-edit");
  assert.equal(strict.get("slides.0.layout"), undefined);
}

// --- pickers: embedded records first, then registered ones, each with the reference to write ------------------------
{
  const editor = createEditorSession(
    { catalogs: { acme: { source: ACME }, custom: { layouts: { mine: { name: "Mine", placeholders: [{ type: "title" }] } } } }, design: {}, slides: [{ title: "One" }] },
    { catalogs: [defaultCatalog, acme()] },
  );
  const layouts = getCatalogOptions("layouts", { editor });
  assert.equal(layouts[0].id, "mine", "the document's own record is listed first");
  assert.equal(layouts[0].origin, "document");
  assert.ok(layouts.some((option) => option.id === "acme:hero" && option.origin === "host" && option.source === ACME));
  assert.ok(layouts.some((option) => option.id === "two-column" && option.group === "default"), "bare ids come from the host default");
  assert.equal(new Set(layouts.map((option) => option.id)).size, layouts.length, "each reference is listed once");
  assert.deepEqual(listSwitchOptions(editor.presentation, "layouts", { catalogs: editor.catalogs }).map((option) => option.id), layouts.map((option) => option.id));

  const change = switchDimension(editor, "layouts", "acme:hero", { slideIndex: 0, catalogs: editor.catalogs });
  assert.equal(change.presentation.slides[0].layout, "acme:hero", "the switch writes the reference core gives");
  setCatalogId(editor, "design.theme", "themes", "acme:brand");
  assert.equal(editor.get("design.theme"), "acme:brand");
  assert.throws(() => setCatalogId(editor, "design.theme", "themes", "nowhere"), (error) => error.code === "unknown-catalog-id");
}

// --- a supplied (gallery) record is embedded in the same transaction ------------------------------------------------
{
  const editor = createEditorSession({ slides: [{ title: "One" }] });
  const record = { id: "team-mono", name: "Team Mono", major: "Inter", minor: "Inter", code: "JetBrains Mono", "x-gallery": { label: "Team" } };
  const change = switchDimension(editor, "font-schemes", "team-mono", { record });
  assert.deepEqual(change.patches.map((patch) => [patch.op, patch.path]), [["add", "/catalogs"], ["add", "/design"]]);
  assert.deepEqual(editor.get("catalogs.custom.fontSchemes.team-mono"), { name: "Team Mono", major: "Inter", minor: "Inter", code: "JetBrains Mono" }, "no id, $schema or x-* fields");
  assert.equal(editor.snapshot().undoDepth, 1);
  const sourced = createEditorSession({ slides: [{ title: "One" }] });
  switchDimension(sourced, "font-schemes", "team-mono", { record, recordSource: "https://www.pptx.gallery" });
  assert.equal(sourced.get("catalogs.default.source"), "https://www.pptx.gallery");
  assert.ok(sourced.get("catalogs.default.fontSchemes.team-mono"));
  assert.equal(sourced.get("design.fontScheme"), "team-mono");
}

// --- themes bring their own schemes: overrides at the switched scope are removed, nothing is copied ---------------
{
  const editor = createEditorSession(
    { catalogs: { acme: { source: ACME } }, design: { colorScheme: "forest-green", fontScheme: "georgia" }, slides: [{ title: "One" }, { title: "Two" }] },
    { catalogs: [defaultCatalog, acme()] },
  );
  const deck = switchDimension(editor, "themes", "acme:brand", {});
  assert.deepEqual(deck.patches, [
    { op: "add", path: "/design/theme", value: "acme:brand" },
    { op: "remove", path: "/design/colorScheme" },
    { op: "remove", path: "/design/fontScheme" },
  ]);
  editor.undo();
  // On a slide whose deck sets a scheme, the theme's value is written on the slide, qualified with the theme's group.
  const slide = switchDimension(editor, "themes", "acme:brand", { slideIndex: 1 });
  assert.deepEqual(editor.get("slides.1.design"), { theme: "acme:brand", colorScheme: "acme:ocean", fontScheme: "acme:inter" });
  assert.equal(slide.scope, "slide");
  const bundleOff = createEditorSession({ design: { fontScheme: "georgia" }, slides: [{ title: "x" }] }, { catalogs: [defaultCatalog] });
  switchDimension(bundleOff, "themes", "classic", { bundle: false });
  assert.deepEqual(bundleOff.get("design"), { fontScheme: "georgia", theme: "classic" });
}

// --- engine vocabularies: languages are BCP-47 tags, charts and socials core's tables ------------------------------
{
  const languages = listSwitchOptions({ slides: [] }, "languages", { vocabularies: { languages: { japanese: { bcp47: "ja", name: "Japanese" } } } });
  assert.ok(languages.some((option) => option.id === "ja" && option.label === "Japanese"));
  assert.ok(languages.some((option) => option.id === "en-US"));
  const editor = createEditorSession({ language: "en-US", speaker: { name: "Alice" }, slides: [{ title: "x", chart: { type: "column", data: { columns: ["Series", "Q1"], rows: [["A", 1]] } } }] });
  switchDimension(editor, "languages", "ja");
  assert.equal(editor.get("language"), "ja");
  assert.throws(() => switchDimension(editor, "charts", "not-a-chart", { slideIndex: 0 }), (error) => error.code === "unknown-catalog-id");
  assert.ok(listSwitchOptions(editor.presentation, "charts").some((option) => option.id === "line"));
  switchDimension(editor, "socials", { platform: "linkedin", handle: "alice" });
  assert.equal(editor.get("speaker.socials.linkedin"), "alice");
  assert.throws(() => switchDimension(editor, "socials", { platform: "myspace-2", handle: "x" }), (error) => error.code === "unknown-catalog-id");
}

// --- save and copy embed every referenced record, so the file renders with no catalog --------------------------------
{
  const doc = { design: { theme: "classic" }, slides: [{ layout: "two-column", title: "A", blocks: [{ text: "1" }, { text: "2" }] }, { layout: "two-column", title: "B" }, { layout: "title", title: "C" }] };
  const editor = createEditorSession(doc, { catalogs: [defaultCatalog] });
  const saved = saveDocument(editor);
  assert.deepEqual(editor.presentation, doc, "saving does not change the session");
  assert.ok(saved.document.catalogs.default.layouts["two-column"], "the used layout is embedded once");
  assert.ok(saved.document.catalogs.default.themes.classic);
  assert.equal(saved.document.catalogs.default.source, defaultCatalog.source);
  assert.deepEqual(saved.unresolved, []);
  const reopened = validate(saved.document, { only: ["format", "references"] });
  assert.deepEqual(reopened.findings.filter((finding) => finding.ruleId === "opf/unresolved-reference"), [], "the saved file resolves with no host catalog");
  for (const record of Object.values(saved.document.catalogs.default.layouts)) assert.ok(!Object.keys(record).some((key) => key.startsWith("x-") || key === "$schema" || key === "id"));
  assert.deepEqual(prepareSave(saved.document, { catalogs: [defaultCatalog] }).document, saved.document, "embedding is idempotent");
  const copied = JSON.parse(serializeOpfTransfer(editor.presentation, { catalogs: editor.catalogs }));
  assert.deepEqual(copied, saved.document, "copying the presentation hands on the embedded document");
  const slide = JSON.parse(serializeOpfTransfer(editor.presentation, { scope: "slide", slideIndex: 2, catalogs: editor.catalogs }));
  assert.equal(slide.slides.length, 1);
  assert.ok(slide.catalogs.default.layouts.title);
}

// --- paste copies records with core's copySlides and reports renames -----------------------------------------------
{
  const record = (text) => ({ name: "Q4", placeholders: [{ type: "title" }, { type: text }] });
  const target = { catalogs: { custom: { layouts: { q4: record("text") } } }, slides: [{ id: "own", layout: "q4", title: "Ours" }] };
  const incoming = { catalogs: { custom: { layouts: { q4: record("list") } } }, slides: [{ id: "theirs", layout: "q4", title: "Theirs" }] };
  const transfer = parseOpfTransfer(JSON.stringify(incoming));
  const result = prepareOpfImport(target, transfer, { mode: "insert", slideIndex: 0, catalogs: [defaultCatalog] });
  assert.equal(result.slideIndex, 1);
  assert.equal(result.presentation.slides[0].layout, "q4", "the target's own slide is unchanged");
  assert.equal(result.presentation.slides[1].layout, "q4-2", "a differing custom record is renamed <id>-2");
  assert.deepEqual(result.presentation.catalogs.custom.layouts["q4-2"], record("list"));
  assert.deepEqual(result.renamed.map(({ from, to, reason }) => [from, to, reason]), [["q4", "q4-2", "custom-conflict"]]);
  assert.ok(!JSON.stringify(result.presentation).includes("import-"), "no import-<id> renaming");
  // The same slide again reuses the first copy's record, which is not a rename.
  const again = prepareOpfImport(result.presentation, transfer, { mode: "insert", slideIndex: 1, catalogs: [defaultCatalog] });
  assert.equal(again.presentation.slides[2].layout, "q4-2");
  assert.deepEqual(again.renamed, [], "a reused record is not listed as renamed");
  assert.deepEqual(Object.keys(again.presentation.catalogs.custom.layouts).sort(), ["q4", "q4-2"], "no third copy");
}

// --- Update from catalog: a review first, then only the approved change, as one undo step ---------------------------
{
  const doc = { catalogs: { acme: { source: ACME } }, design: { theme: "acme:brand" }, slides: [{ layout: "acme:hero", title: "x" }] };
  const embedded = prepareSave(doc, { catalogs: [acme(1)] }).document;
  const editor = createEditorSession(embedded, { catalogs: [acme(2)] });
  const update = checkCatalogUpdates(editor.presentation, { catalogs: editor.catalogs });
  assert.deepEqual(update.changes.map(({ kind, reference }) => [kind, reference]), [["colorSchemes", "acme:ocean"]]);
  assert.deepEqual(editor.presentation, embedded, "checking changes nothing");
  assert.throws(() => applyCatalogUpdate(editor, { refs: [] }), (error) => error.code === "no-approved-updates");
  const applied = applyCatalogUpdate(editor, { refs: [{ kind: "colorSchemes", reference: "acme:ocean" }] });
  assert.equal(applied.changed, true);
  assert.equal(editor.get("catalogs.acme.colorSchemes.ocean.accent1"), "#005F8F");
  assert.equal(editor.snapshot().undoDepth, 1);
  assert.deepEqual(checkCatalogUpdates(editor.presentation, { catalogs: editor.catalogs }).changes, []);
  editor.undo();
  assert.deepEqual(editor.presentation, embedded);
}

// --- the library imports no catalog data: only the playground (the host app's entry) does -----------------------------
{
  for (const file of await readdir(new URL("../dist/", import.meta.url))) {
    if (!file.endsWith(".js")) continue;
    const text = await readFile(new URL(`../dist/${file}`, import.meta.url), "utf8");
    assert.ok(!/(?:from\s*|import\s*\(\s*)["']@openpresentation\/opf\/catalog["']/.test(text), `${file} must not import @openpresentation/opf/catalog`);
    assert.ok(!/\b(?:"|')(?:minimal|cool-horizon|title-subtitle)(?:"|')/.test(text), `${file} must not hard-code catalog ids`);
  }
  const playground = await readFile(new URL("../examples/playground.js", import.meta.url), "utf8");
  assert.match(playground, /from '@openpresentation\/opf\/catalog'/, "the playground registers the default catalog");
}

console.log("catalogs ok: one merged list, references from catalogRecords, embed on save and copy, copySlides on paste, approved catalog updates, reference findings");

// --- a record its catalog does not publish: the finding, and "move to custom" -------------------------------------------
{
  const doc = {
    catalogs: { acme: { source: ACME, layouts: { "q4-special": { name: "Q4", placeholders: [{ type: "title" }] } }, themes: { promo: { name: "Promo", colorScheme: "ocean" } } } },
    design: { theme: "acme:promo" },
    slides: [{ layout: "acme:q4-special", title: "x" }],
  };
  const editor = createEditorSession(doc, { catalogs: [defaultCatalog, acme()] });
  const notInSource = referenceFindings(editor.validation).filter((finding) => finding.ruleId === "opf/catalog-record-not-in-source");
  assert.deepEqual(notInSource.map((finding) => catalogRecordAt(finding.path)).sort((a, b) => a.kind.localeCompare(b.kind)), [{ group: "acme", kind: "layouts", id: "q4-special" }, { group: "acme", kind: "themes", id: "promo" }]);
  const moved = moveToCustom(editor, { group: "acme", kind: "themes", id: "promo" });
  assert.deepEqual(moved.to, { group: "custom", kind: "themes", id: "promo" });
  assert.equal(editor.get("design.theme"), "promo", "the reference follows the record");
  assert.equal(editor.get("catalogs.custom.themes.promo.colorScheme"), "acme:ocean", "a reference inside it keeps naming acme's record");
  assert.equal(editor.get("catalogs.acme.themes"), undefined);
  assert.equal(editor.snapshot().undoDepth, 1);
  moveToCustom(editor, { group: "acme", kind: "layouts", id: "q4-special" });
  assert.equal(editor.get("slides.0.layout"), "q4-special");
  assert.deepEqual(referenceFindings(editor.validation), [], "nothing left to report");
  assert.throws(() => moveToCustom(editor, { group: "custom", kind: "layouts", id: "q4-special" }), (error) => error.code === "not-a-catalog-record");
  editor.undo();
  editor.undo();
  assert.deepEqual(editor.presentation, doc);
}
console.log("catalogs ok: not-in-source records move to custom with their references");

// --- owner rule: editing a catalog's record forks it into catalogs.custom, in one undo step -----------------------------
{
  const embedded = prepareSave({ catalogs: { acme: { source: ACME } }, design: { theme: "acme:brand", colorScheme: "acme:ocean" }, slides: [{ layout: "acme:hero", title: "x" }, { layout: "acme:hero", title: "y" }] }, { catalogs: [acme(1)] }).document;
  const editor = createEditorSession(embedded, { catalogs: [acme(1)] });
  const events = [];
  editor.subscribe((event) => events.push(event));
  const change = editor.set("catalogs.acme.layouts.hero.name", "Our hero");
  assert.deepEqual(change.forked, [{ from: { group: "acme", kind: "layouts", id: "hero" }, to: { group: "custom", kind: "layouts", id: "hero-custom" } }]);
  assert.match(change.notice, /now this presentation's own \(hero-custom\); it no longer receives catalog updates/);
  assert.equal(events.at(-1).meta.notice, change.notice, "the session event carries the notice");
  assert.equal(editor.get("catalogs.custom.layouts.hero-custom.name"), "Our hero", "the edit lands on the fork");
  assert.equal(editor.get("catalogs.acme.layouts.hero"), undefined, "the original is dropped");
  assert.deepEqual(editor.presentation.slides.map((slide) => slide.layout), ["hero-custom", "hero-custom"], "every reference follows the fork");
  assert.equal(editor.snapshot().undoDepth, 1, "the fork and the edit are one undo step");
  // Update from catalog no longer lists the forked record.
  const updates = checkCatalogUpdates(editor.presentation, { catalogs: [acme(2)] });
  assert.ok(!updates.changes.some((entry) => entry.kind === "layouts"), "a forked record receives no catalog updates");
  // A fork id the user gives.
  editor.applyPatch([{ op: "replace", path: "/catalogs/acme/colorSchemes/ocean/accent1", value: "#123456" }], { forkIds: { "acme:colorSchemes:ocean": "our-ocean" } });
  assert.equal(editor.get("design.colorScheme"), "our-ocean");
  assert.equal(editor.get("catalogs.custom.themes"), undefined, "only the edited record forks");
  // Undo restores both the catalog's record and the references.
  editor.undo();
  editor.undo();
  assert.deepEqual(editor.presentation, embedded);
  // A custom record is edited in place.
  const own = createEditorSession({ catalogs: { custom: { layouts: { mine: { name: "Mine", placeholders: [{ type: "title" }] } } } }, slides: [{ layout: "mine", title: "x" }] });
  const inPlace = own.set("catalogs.custom.layouts.mine.name", "Mine, renamed");
  assert.equal(inPlace.forked, undefined);
  assert.equal(own.get("slides.0.layout"), "mine");
  assert.equal(own.get("catalogs.custom.layouts.mine.name"), "Mine, renamed");
  // Applying an approved catalog update changes the catalog's record in place (it is not a user edit).
  const updating = createEditorSession(embedded, { catalogs: [acme(2)] });
  const applied = applyCatalogUpdate(updating, { refs: [{ kind: "colorSchemes", reference: "acme:ocean" }] });
  assert.equal(applied.forked, undefined);
  assert.equal(updating.get("design.colorScheme"), "acme:ocean");
}
console.log("catalogs ok: editing a catalog record forks it into custom (one undo step, references follow, no catalog updates)");
