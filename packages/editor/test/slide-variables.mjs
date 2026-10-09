// FA-31: the editor composes the slide with the slide-scoped built-ins ({{slide.number}}, {{slide.section}}, {{deck.slideCount}})
// substituted, the way the renderer draws it and the exporter writes it, and keeps the tokens in the document it edits.
import assert from "node:assert/strict";
import { renderSlideSvg } from "@openpresentation/opf-render/svg";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import { createEditorSession } from "../dist/index.js";
import { replaceAll } from "../dist/find-replace.js";
import { setHeaderFooterZone } from "../dist/design-options.js";

const catalogs = [defaultCatalog];
const deck = () => ({
  name: "Quarterly review",
  design: { theme: "minimal", fontScheme: "roboto", footer: { right: { text: "{{slide.number}} / {{deck.slideCount}}" } } },
  slides: [
    { id: "one", title: "One", section: "Intro", text: "Slide {{slide.number}} of {{deck.slideCount}} in {{slide.section}}" },
    { id: "two", title: "Two", text: "Slide {{slide.number}} of {{deck.slideCount}}" },
    { id: "three", title: "Three", section: "Close", text: "\\{{slide.number}} stays literal" },
  ],
});
const editor = createEditorSession(deck(), { rejectInvalid: true, catalogs });
const furniture = (composed) => JSON.stringify(composed.furniture);

// composeSlide draws the slide's own place in the open deck, and the footer's field.
{
  const second = editor.composeSlide(1);
  assert.ok(JSON.stringify(second).includes("Slide 2 of 3"), "body text carries this slide's number and the deck's count");
  assert.ok(furniture(second).includes("2 / 3"), "so does the footer");
  assert.ok(furniture(second).includes('"slideNumber"'), "the footer keeps the slide number field for the exporter");
  const first = editor.composeSlide(0);
  assert.ok(JSON.stringify(first).includes("Slide 1 of 3 in Intro"), "the section is the slide's own");
  // The numbers a host shows can differ from the deck's order (a section of a bigger deck, a paginated slide).
  const shifted = editor.composeSlide(1, { slideNumber: 7, slideCount: 9 });
  assert.ok(JSON.stringify(shifted).includes("Slide 7 of 9") && furniture(shifted).includes("7 / 9"));
  // An escaped token is literal text.
  assert.ok(JSON.stringify(editor.composeSlide(2)).includes("{{slide.number}} stays literal"));
  // Never a token left behind in a slide that has the value.
  assert.ok(!/\{\{(slide|deck)\./.test(JSON.stringify(second).replace(/\\\{\{/g, "")), "no slide-scoped token is left in the composed slide");
}

// The document keeps the tokens, and the preview draws the same numbers as composeSlide.
{
  assert.equal(editor.presentation.slides[1].text, "Slide {{slide.number}} of {{deck.slideCount}}");
  const svg = renderSlideSvg(editor.presentation, 1, { catalogs });
  assert.ok(svg.includes("Slide 2 of 3") && svg.includes("2 / 3"), "the preview draws the substituted slide");
}

// Pagination measures with the values but leaves the tokens in the slides it commits.
{
  const long = createEditorSession(
    { name: "Long", design: { theme: "minimal", fontScheme: "roboto" }, slides: [{ id: "list", title: "Page {{slide.number}} of {{deck.slideCount}}", items: Array.from({ length: 60 }, (_, index) => `Point number ${index + 1} with enough words to take a full line of the slide`) }] },
    { rejectInvalid: true, catalogs },
  );
  const { change, pagination } = long.paginateSlide(0);
  assert.ok(change && pagination.slides.length > 1, "the long list splits");
  for (const slide of long.presentation.slides) assert.ok(slide.title.includes("{{slide.number}}"), "each page keeps the token");
  const svg = renderSlideSvg(long.presentation, 1, { catalogs });
  assert.ok(svg.includes(`Page 2 of ${long.presentation.slides.length}`), "and draws its own number and the new count");
  long.undo();
  assert.equal(long.presentation.slides.length, 1, "one undo puts the slide back");
}

// Edits keep working on a slide that uses tokens: a footer change and a replace leave them alone.
{
  setHeaderFooterZone(editor, "footer", "left", { text: "Review" });
  assert.equal(editor.presentation.design.footer.right.text, "{{slide.number}} / {{deck.slideCount}}");
  replaceAll(editor, "Slide", "Page");
  assert.equal(editor.presentation.slides[1].text, "Page {{slide.number}} of {{deck.slideCount}}");
}

console.log("Slide variables (editor): composeSlide and the preview substitute {{slide.number}}, {{slide.section}} and {{deck.slideCount}}; pagination and edits keep the tokens.");
