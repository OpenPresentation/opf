import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { OPFConversionError, mergeSlides, splitSlide, splitSlideOnOverflow, unpaginate } from "../dist/convert.js";
import { composeSlide } from "../dist/composition.js";
import { paginatePresentation } from "../dist/pagination.js";
import { validatePresentation } from "../dist/index.js";

const refused = (action, pattern) =>
  assert.throws(
    action,
    (error) => error instanceof OPFConversionError && error.code === "not-convertible" && pattern.test(error.message),
  );
const sentence = "Keep every word, space, and emoji.\n";
const longText = sentence.repeat(100);

describe("split by blocks", () => {
  const deck = {
    slides: [
      { id: "a", title: "First", text: "A" },
      { id: "b", title: "Plan", subtitle: "Sub", notes: "Say hello", section: "Intro", layout: "text-1x", design: { theme: "minimal" }, blocks: [{ id: "x", text: "One" }, { id: "y", items: ["Two"] }, { id: "z", text: "Three" }] },
      { id: "b--2", text: "Taken" },
    ],
  };

  test("split at a block puts the blocks on separate slides and copies the slide fields", () => {
    const result = splitSlide(deck, 1, { at: [1] });
    assert.deepEqual(result.range, { start: 1, deleteCount: 1 });
    assert.equal(result.presentation.slides.length, 4);
    const [first, second] = result.slides;
    assert.deepEqual(first, { id: "b", title: "Plan", subtitle: "Sub", notes: "Say hello", section: "Intro", layout: "text-1x", design: { theme: "minimal" }, blocks: [{ id: "x", text: "One" }] });
    // The id avoids the one the deck already has; notes stay on the first slide.
    assert.equal(second.id, "b--3");
    assert.equal(second.notes, undefined);
    assert.deepEqual([second.title, second.subtitle, second.section, second.layout], ["Plan", "Sub", "Intro", "text-1x"]);
    assert.deepEqual(second.blocks.map((block) => block.id), ["y", "z"]);
    assert.equal(result.lossless, true);
    assert.ok(validatePresentation(result.presentation).valid);
    assert.equal(deck.slides.length, 3, "the input is not changed");
  });

  test("each puts one block per slide; headings can be left off the continuation slides", () => {
    const result = splitSlide(deck, 1, { each: true, repeatHeadings: false });
    assert.equal(result.slides.length, 3);
    assert.deepEqual(result.slides.map((slide) => slide.title), ["Plan", undefined, undefined]);
    assert.deepEqual(result.slides.map((slide) => slide.blocks.length), [1, 1, 1]);
    assert.deepEqual(result.slides.map((slide) => slide.id), ["b", "b--3", "b--4"]);
  });

  test("a slide with inline content or named regions splits by field or by region", () => {
    const inline = splitSlide({ slides: [{ title: "T", text: "A", items: ["B"] }] }, 0, { each: true });
    assert.deepEqual(inline.slides.map((slide) => slide.blocks), [[{ text: "A" }], [{ items: ["B"] }]]);
    const regions = splitSlide({ slides: [{ left: { text: "L" }, right: { text: "R" } }] }, 0, { each: true });
    assert.deepEqual(regions.slides.map((slide) => slide.blocks[0].text), ["L", "R"]);
    assert.deepEqual(regions.loss, ["region placement"]);
  });

  test("split refuses one block, no split point and out of range points", () => {
    refused(() => splitSlide(deck, 0, { each: true }), /one block/);
    refused(() => splitSlide(deck, 1), /Choose where to split/);
    refused(() => splitSlide(deck, 1, { at: [0] }), /between blocks/);
    refused(() => splitSlide(deck, 1, { at: [3] }), /between blocks/);
    refused(() => splitSlide(deck, 7, { each: true }), /exists/);
  });
});

describe("merge", () => {
  test("merging concatenates the blocks, joins the notes and keeps the first slide's fields", () => {
    const deck = { slides: [{ id: "a", title: "T", notes: "one", layout: "text-1x", text: "A" }, { id: "b", title: "T", notes: "two", layout: "text-1x", blocks: [{ items: ["B"] }, { text: "C" }] }, { id: "c", title: "Other", text: "D" }] };
    const result = mergeSlides(deck, 0, 2);
    assert.deepEqual(result.slides[0], { id: "a", title: "T", layout: "text-1x", blocks: [{ text: "A" }, { items: ["B"] }, { text: "C" }], notes: "one\n\ntwo" });
    assert.deepEqual(result.range, { start: 0, deleteCount: 2 });
    assert.equal(result.presentation.slides.length, 2);
    assert.deepEqual(result.loss, ['slide id "b"']);
    const all = mergeSlides(deck, 0, 3);
    assert.deepEqual(all.loss, ['slide id "b"', 'slide id "c"', "title of slide 3"]);
  });

  test("merge is the inverse of split by blocks, apart from the new ids", () => {
    const deck = { slides: [{ id: "s", title: "T", blocks: [{ text: "A" }, { items: ["B"] }, { text: "C" }] }] };
    const split = splitSlide(deck, 0, { each: true });
    const merged = mergeSlides(split.presentation, 0, 3);
    assert.deepEqual(merged.slides[0], deck.slides[0]);
    assert.deepEqual(merged.loss, ['slide id "s--2"', 'slide id "s--3"']);
  });

  test("merge refuses a single slide, missing slides and regions", () => {
    const deck = { slides: [{ text: "A" }, { left: { text: "L" } }, { text: "B" }] };
    refused(() => mergeSlides(deck, 0, 1), /at least two/);
    refused(() => mergeSlides(deck, 2, 2), /exist/);
    refused(() => mergeSlides(deck, 0, 2), /named regions/);
  });
});

describe("split on overflow and un-paginate", () => {
  const list = Array.from({ length: 60 }, (_, index) => ({ text: `Point ${index}`, description: "Preserve item metadata." }));
  const table = { columns: ["Item", "Value"], rows: Array.from({ length: 50 }, (_, index) => [`row ${index}`, index]) };
  const deck = {
    slides: [
      { id: "a", title: "First", text: "Short" },
      { id: "b", title: "Long", notes: "Notes", blocks: [{ id: "t", text: longText }, { items: list }, { table }] },
      { id: "c", title: "Last", text: "Short" },
    ],
  };

  test("a slide that fits is returned unchanged", () => {
    const result = splitSlideOnOverflow(deck, 0);
    assert.equal(result.changed, false);
    assert.deepEqual(result.slides, [deck.slides[0]]);
    assert.equal(result.pages.length, 0);
  });

  test("an overflowing slide becomes pages that keep every word, item and row", () => {
    const result = splitSlideOnOverflow(deck, 1);
    assert.equal(result.changed, true);
    assert.ok(result.slides.length > 3);
    assert.deepEqual(result.range, { start: 1, deleteCount: 1 });
    assert.equal(result.presentation.slides.length, deck.slides.length - 1 + result.slides.length);
    assert.equal(result.presentation.slides[0].id, "a");
    assert.equal(result.presentation.slides.at(-1).id, "c");
    assert.ok(validatePresentation(result.presentation).valid);
    const bodies = result.slides.flatMap((slide) => slide.blocks);
    assert.equal(bodies.filter((block) => block.text !== undefined).map((block) => block.text).join(""), longText);
    assert.deepEqual(bodies.flatMap((block) => block.items ?? []), list);
    assert.deepEqual(bodies.flatMap((block) => block.table?.rows ?? []), table.rows);
    for (const slide of result.slides) assert.equal(composeSlide(slide).diagnostics.length, 0);
    const ids = result.presentation.slides.flatMap((slide) => [slide.id, ...(slide.blocks ?? []).map((block) => block.id)]).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, "ids stay unique in the document");
    assert.equal(result.slides[0].notes, "Notes");
    assert.equal(result.slides[1].notes, undefined);
    for (const [index, page] of result.pages.entries()) assert.equal(page.slideIndex, 1 + index);
    assert.deepEqual(splitSlideOnOverflow(deck, 1), result, "deterministic");
  });

  test("a slide whose content cannot fit is refused with the pagination reason", () => {
    const huge = { slides: [{ title: "x".repeat(4000), text: "body" }] };
    refused(() => splitSlideOnOverflow(huge, 0), /cannot fit|heading/i);
  });

  test("un-paginate puts the original text, items and rows back into one slide", () => {
    const split = splitSlideOnOverflow(deck, 1);
    const back = unpaginate(split.presentation, split.pages);
    assert.deepEqual(back.range, { start: 1, deleteCount: split.slides.length });
    assert.equal(back.presentation.slides.length, deck.slides.length);
    const slide = back.presentation.slides[1];
    assert.equal(slide.id, "b");
    assert.equal(slide.title, "Long");
    assert.equal(slide.notes, "Notes");
    assert.equal(slide.blocks.length, 3);
    assert.equal(slide.blocks[0].text, longText);
    assert.equal(slide.blocks[0].id, "t");
    assert.deepEqual(slide.blocks[1].items, list);
    assert.deepEqual(slide.blocks[2].table, table);
    assert.deepEqual(back.presentation.slides[0], deck.slides[0]);
    assert.deepEqual(back.presentation.slides[2], deck.slides[2]);
  });

  test("un-paginate refuses slides that are not the pages it was given", () => {
    const split = splitSlideOnOverflow(deck, 1);
    const truncated = structuredClone(split.presentation);
    truncated.slides.splice(split.slides.length, 1);
    refused(() => unpaginate(truncated, split.pages), /no longer has|next to each other/);
    const gap = structuredClone(split.pages);
    gap[1].mappings[0].range.start += 1;
    refused(() => unpaginate(split.presentation, gap), /not consecutive/);
    const apart = split.pages.map((page, index) => (index === 1 ? { ...page, slideIndex: page.slideIndex + 1 } : page));
    refused(() => unpaginate(split.presentation, apart), /next to each other/);
    refused(() => unpaginate(deck, []), /not split/);
  });

  test("un-paginate puts back several paginated slides of a whole presentation as one range", () => {
    const three = { slides: [{ id: "p", title: "One", text: longText }, { id: "q", title: "Middle", text: "Short" }, { id: "r", title: "Two", text: longText }] };
    const paginated = paginatePresentation(three);
    assert.ok(paginated.presentation.slides.length > 4);
    const back = unpaginate(paginated.presentation, paginated.pages);
    assert.equal(back.range.start, 0);
    assert.equal(back.range.deleteCount, paginated.presentation.slides.length);
    assert.equal(back.slides.length, 3);
    assert.deepEqual(back.presentation.slides.map((slide) => slide.id), ["p", "q", "r"]);
    assert.deepEqual(back.presentation.slides.map((slide) => slide.text), [longText, "Short", longText]);
    const only = unpaginate(paginated.presentation, paginated.pages, { sourceSlideIndex: 2 });
    assert.equal(only.slides.length, 1);
    assert.equal(only.slides[0].id, "r");
    assert.equal(only.presentation.slides.length, paginated.presentation.slides.length - (only.range.deleteCount - 1));
  });

  test("a text-only continuation round trips exactly, including emoji", () => {
    const text = "Emoji 👨‍👩‍👧‍👦 stays whole. ".repeat(120);
    const one = { slides: [{ id: "s", title: "T", text }] };
    const split = splitSlideOnOverflow(one, 0);
    assert.ok(split.slides.length > 1);
    const back = unpaginate(split.presentation, split.pages);
    assert.equal(back.presentation.slides.length, 1);
    assert.equal(back.presentation.slides[0].text, text);
  });
});
