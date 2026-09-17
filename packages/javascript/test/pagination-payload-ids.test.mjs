import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { paginateSlide, paginatePresentation, validatePresentation } from "../dist/index.js";

const regionKey = /^(top|middle|bottom|left|center|right)([+:]|$)/;
const items = Array.from({ length: 60 }, (_, index) => `Point ${index}: ${"detail ".repeat(11)}`);

const isPayload = (value) => !!value && typeof value === "object" && !Array.isArray(value);

const payloadIds = (slide) => {
  const ids = [];
  const walk = (payload) => {
    if (typeof payload.id === "string") ids.push(payload.id);
    if (Array.isArray(payload.blocks)) for (const block of payload.blocks) if (isPayload(block)) walk(block);
  };
  if (Array.isArray(slide.blocks)) for (const block of slide.blocks) if (isPayload(block)) walk(block);
  for (const [key, value] of Object.entries(slide)) {
    if (regionKey.test(key) && isPayload(value)) walk(value);
  }
  return ids;
};

const documentIds = (slides) =>
  slides.flatMap((slide) => (typeof slide.id === "string" ? [slide.id, ...payloadIds(slide)] : payloadIds(slide)));

/** Paginate, then hold the output to the contract paginatePresentation promises. */
const paginated = (deck) => {
  const { presentation } = paginatePresentation(deck);
  const result = validatePresentation(presentation);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(presentation.slides.length > 1, "the fixture must overflow onto continuation pages");
  const ids = documentIds(presentation.slides);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.join(", ")}`);
  return presentation.slides;
};

describe("pagination keeps content payload ids unique", () => {
  test("an overflowing block payload keeps its id on the first page only", () => {
    const [first, ...rest] = paginated({ name: "Long", slides: [{ id: "long", blocks: [{ id: "the-list", items }] }] });
    assert.deepEqual(payloadIds(first), ["the-list"]);
    assert.equal(first.id, "long");
    for (const page of rest) {
      for (const id of payloadIds(page)) assert.match(id, /^the-list--\d+$/);
    }
  });

  test("an overflowing region payload keeps its id on the first page only", () => {
    const [first, ...rest] = paginated({ name: "Long", slides: [{ left: { id: "sidebar", items } }] });
    assert.deepEqual(payloadIds(first), ["sidebar"]);
    for (const page of rest) {
      for (const id of payloadIds(page)) assert.match(id, /^sidebar--\d+$/);
    }
  });

  test("a generated continuation id never takes an id the document already uses", () => {
    const slides = paginated({
      name: "Reserved",
      slides: [
        { blocks: [{ id: "long", items }] },
        { title: "Wrap-up", blocks: [{ id: "long--2", text: "Keep this id." }] },
      ],
    });
    assert.deepEqual(payloadIds(slides.at(-1)), ["long--2"]);
    const generated = slides.slice(1, -1).flatMap(payloadIds);
    assert.ok(generated.length > 0, "the fixture must produce continuation payloads");
    for (const id of generated) assert.match(id, /^long--\d+$/);
    assert.ok(!generated.includes("long--2"));
  });

  test("reservedIds also covers payload ids supplied by the host", () => {
    const { slides } = paginateSlide({ blocks: [{ id: "the-list", items }] }, { reservedIds: ["the-list--2"] });
    assert.ok(slides.length > 1);
    assert.deepEqual(slides.flatMap(payloadIds).slice(0, 2), ["the-list", "the-list--3"]);
  });
});
