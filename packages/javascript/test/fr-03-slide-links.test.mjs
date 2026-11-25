import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { assignIds, collectSlideLinks, slideLink, slideLinkId } from "../dist/index.js";
import { fromMarkdown, toMarkdown } from "../dist/markdown.js";
import { continueOverfull, paginate, paginateSlide } from "../dist/pagination.js";
import { validate } from "../dist/validator.js";
import { fromYaml, toYaml } from "../dist/yaml.js";

// FR-03: a link to a slide of the same deck is `slide:<id>`, spelled like `asset:` and `var:`.
const deck = (link = "slide:pricing") => ({
  $schema: "https://openpresentation.org/schema/opf/v1",
  name: "Agenda",
  slides: [
    {
      id: "agenda",
      title: "Agenda",
      blocks: [
        { text: [{ text: "Pricing", link }, { text: " and " }, { text: "mail", link: "mailto:hi@acme.com" }] },
        { shape: "roundRect", text: "Jump", link },
      ],
    },
    { id: "pricing", title: "Pricing", table: { columns: ["Plan", "Where"], rows: [["Pro", [{ text: "Back to the agenda", link: "slide:agenda" }]]] } },
  ],
});

const slideLinkFindings = (document) => validate(document, { only: ["format"] }).findings.filter((finding) => finding.ruleId === "opf/slide-link-unknown");
const schemaErrors = (document) => validate(document, { only: ["format"] }).findings.filter((finding) => finding.severity === "error");

describe("FR-03 slide links", () => {
  test("helpers read and write the spelling", () => {
    assert.equal(slideLink("pricing"), "slide:pricing");
    assert.equal(slideLinkId("slide:pricing"), "pricing");
    assert.equal(slideLinkId("slide:"), undefined);
    assert.equal(slideLinkId("https://acme.com"), undefined);
    assert.equal(slideLinkId(undefined), undefined);
    assert.deepEqual(
      collectSlideLinks(deck().slides).map((entry) => entry.id),
      ["pricing", "pricing", "agenda"],
    );
  });

  test("a link to a slide of the deck is valid on a run, a shape block and a table cell", () => {
    assert.deepEqual(schemaErrors(deck()), []);
  });

  test("a link to an unknown slide is an error with the path of the link", () => {
    const findings = slideLinkFindings(deck("slide:prices"));
    assert.equal(findings.length, 2);
    assert.equal(findings[0].severity, "error");
    assert.match(findings[0].path, /^\/slides\/0\/blocks\/[01]\/(text\/0\/)?link$/);
    assert.equal(slideLinkFindings(deck()).length, 0);
  });

  test("an overlay shape link names a slide too", () => {
    const document = deck();
    document.slides[0].shapes = [{ shape: "rect", x: 0.1, y: 0.1, width: 0.2, height: 0.1, link: "slide:nowhere" }];
    assert.ok(slideLinkFindings(document).some((finding) => finding.path === "/slides/0/shapes/0/link"));
    document.slides[0].shapes[0].link = "slide:pricing";
    assert.equal(slideLinkFindings(document).length, 0);
    assert.deepEqual(schemaErrors(document), []);
  });

  test("a link with another scheme is still a schema error", () => {
    const findings = schemaErrors(deck("ftp://acme.com"));
    assert.ok(findings.some((finding) => finding.ruleId === "opf/schema"));
  });

  test("a slide without an id cannot be linked to; assignIds gives it one", () => {
    const document = deck();
    delete document.slides[1].id;
    assert.ok(slideLinkFindings(document).length > 0);
    const { document: withIds, assigned } = assignIds(document);
    const target = assigned.find((entry) => entry.pointer === "/slides/1")?.id;
    assert.ok(target);
    withIds.slides[0].blocks[1].link = slideLink(target);
    assert.equal(slideLinkFindings(withIds).filter((finding) => finding.path.endsWith("blocks/1/link")).length, 0);
  });

  test("the links survive a Markdown round trip", () => {
    const written = toMarkdown(deck());
    assert.match(written.markdown, /\(slide:pricing\)/);
    const read = fromMarkdown(written.markdown);
    const links = collectSlideLinks(read.presentation.slides).map((entry) => entry.id);
    assert.ok(links.includes("pricing"), written.markdown);
    assert.ok(links.includes("agenda"), written.markdown);
    assert.equal(read.valid, true, JSON.stringify(read.findings));
  });

  test("the links survive a YAML round trip", () => {
    const written = toYaml(deck());
    assert.match(written.yaml, /link: slide:pricing/);
    const read = fromYaml(written.yaml);
    assert.equal(read.valid, true);
    assert.deepEqual(read.presentation, deck());
  });

  test("a slide checked on its own is judged against the rest of its deck, and not at all without one", () => {
    const document = deck();
    // validate: a part of a deck can say its slide links are the enclosing document's check, or list the other slides.
    const alone = { slides: [document.slides[0]] };
    assert.ok(slideLinkFindings(alone).length > 0, "alone, the links name slides the document does not have");
    assert.equal(validate(alone, { only: ["format"], slideLinks: false }).findings.filter((finding) => finding.ruleId === "opf/slide-link-unknown").length, 0);
    assert.equal(validate(alone, { only: ["format"], slideLinks: ["pricing"] }).findings.filter((finding) => finding.ruleId === "opf/slide-link-unknown").length, 0);
    assert.ok(validate(alone, { only: ["format"], slideLinks: ["other"] }).findings.some((finding) => finding.ruleId === "opf/slide-link-unknown"));
    // pagination and continuation check one slide at a time: they must not reject links to the deck's other slides.
    assert.equal(continueOverfull(document, {}).presentation.slides.length, 2);
    assert.equal(paginate(document, {}).presentation.slides.length, 2);
    assert.doesNotThrow(() => paginateSlide(document.slides[0], { presentation: document }));
    assert.doesNotThrow(() => paginateSlide(document.slides[0], {}), "with no deck given the links are not judged");
  });
});
