// LH-99: hosts that draw slide by slide (the player, <opf-deck>, server markup) show the export's continuation (LH-90) of an overfull
// slide as pages after it, without shifting a source slide's index: numbers, `goto`, `gotoIndex` and the slide labels keep
// addressing source slides, and the pages are sub-steps of their slide.
import assert from "node:assert/strict";
import { test } from "node:test";
import { gallery } from "@openpresentation/gallery";
import { continueOverfull } from "@openpresentation/opf";
import { createCursor, createDeckStore, createSync, slideLabel } from "../dist/deck-runtime.js";
import { toHtml } from "../dist/element.js";
import { toSvg } from "../dist/svg.js";

const catalogs = [gallery];
const timeline = (index) => ({ timeline: { name: `Workstream ${index + 1} execution path`, description: `Major milestones for workstream ${index + 1}.`, events: [
  { when: "May", what: "Baseline", description: "Confirm current state, owners, and constraints." },
  { when: "Jun", what: "Pilot", description: "Run a narrow pilot with visible success criteria." },
  { when: "Jul", what: "Scale", description: "Expand the approach after risk review." },
  { when: "Aug", what: "Embed", description: "Move reporting and routines into steady-state operations." },
] } });
/** Four slides; the second is eight timelines that the export continues on two pages. */
const deck = () => ({ name: "Plan", slides: [
  { id: "intro", title: "Plan" },
  { id: "plan", layout: "process", title: "Execution paths for the next cycle", notes: "Walk through each path.", blocks: Array.from({ length: 8 }, (_, index) => timeline(index)) },
  { id: "hidden", title: "Backup", hidden: true },
  { id: "close", title: "Next steps" },
] });

test("the store draws each page of a continued slide as the export does, and nothing else moves", () => {
  const document = deck();
  const store = createDeckStore({ document, renderOptions: { catalogs } });
  assert.deepEqual([0, 1, 2, 3].map((index) => store.pages(index)), [1, 2, 1, 1]);
  assert.equal(store.continued.length, 1);
  assert.equal(store.continued[0].sourceSlideIndex, 1);
  // The pages are the export's: the same SVG `toSvg` draws for the continued deck.
  const exported = continueOverfull(document, { catalogs }).presentation;
  assert.equal(store.svg(1, 0), toSvg(exported, 2, { catalogs }));
  assert.equal(store.svg(1, 1), toSvg(exported, 3, { catalogs }));
  // A slide after the continued one is addressed by its source index and draws the export's slide 5.
  assert.equal(store.svg(3), toSvg(exported, 5, { catalogs }));
  // A page past the end is the last page; info stays the source slide's.
  assert.equal(store.svg(1, 9), store.svg(1, 1));
  assert.equal(store.info(1).id, "plan");
  assert.equal(store.info(3).id, "close");
  assert.equal(document.slides.length, 4, "the document is not changed");
});

test("continuation off, and a deck without an overfull slide, draw every slide as written", () => {
  const document = deck();
  const off = createDeckStore({ document, renderOptions: { catalogs }, continuation: false });
  assert.deepEqual([0, 1, 2, 3].map((index) => off.pages(index)), [1, 1, 1, 1]);
  assert.equal(off.svg(1), toSvg(document, 2, { catalogs }));
  const fits = { slides: [{ id: "a", title: "One" }, { id: "b", title: "Two", blocks: [timeline(0), timeline(1)] }] };
  const store = createDeckStore({ document: fits, renderOptions: { catalogs } });
  assert.deepEqual(store.continued, []);
  assert.equal(store.svg(1), toSvg(fits, 2, { catalogs }));
});

test("the cursor steps through pages as sub-steps; slide numbers and goto address source slides", () => {
  const pages = { 0: 1, 1: 2, 3: 1 };
  // The sequence that plays skips the hidden slide (document index 2).
  const cursor = createCursor([0, 1, 3], 0, { pagesOf: (index) => pages[index] });
  const at = () => [cursor.number, cursor.index, cursor.page, cursor.pages];
  assert.deepEqual(at(), [1, 0, 0, 1]);
  assert.ok(cursor.atStart);
  assert.ok(cursor.next());
  assert.deepEqual(at(), [2, 1, 0, 2], "slide 2, page 1 of 2");
  assert.ok(cursor.next());
  assert.deepEqual(at(), [2, 1, 1, 2], "a page step keeps the slide number");
  assert.ok(cursor.next());
  assert.deepEqual(at(), [3, 3, 0, 1], "the slide after the continued one is still slide 3, document index 3");
  assert.ok(cursor.atEnd);
  assert.equal(cursor.next(), false);
  assert.ok(cursor.previous());
  assert.deepEqual(at(), [2, 1, 1, 2], "back from the next slide lands on the last page");
  assert.ok(cursor.previous());
  assert.deepEqual(at(), [2, 1, 0, 2]);
  assert.ok(cursor.goto(3));
  assert.deepEqual(at(), [3, 3, 0, 1], "goto(n) is the source slide n");
  assert.ok(cursor.goto(2));
  assert.deepEqual(at(), [2, 1, 0, 2], "goto starts on the first page");
  assert.ok(cursor.gotoIndex(1, 1));
  assert.deepEqual(at(), [2, 1, 1, 2], "gotoIndex takes a page");
  assert.ok(cursor.last());
  assert.deepEqual(at(), [3, 3, 0, 1]);
  assert.ok(cursor.first());
  assert.deepEqual(at(), [1, 0, 0, 1]);
  assert.deepEqual(cursor.peek(1), { position: 1, index: 1, page: 0 });
  assert.equal(cursor.peek(-1), undefined);
  assert.equal(cursor.total, 3, "the total counts source slides");
  // Without pagesOf every slide is one page: the cursor moves as before.
  const plain = createCursor([0, 1, 3]);
  assert.ok(plain.next());
  assert.deepEqual([plain.number, plain.index, plain.page, plain.pages], [2, 1, 0, 1]);
  assert.ok(plain.last());
  assert.equal(plain.number, 3);
});

test("labels name the page of a continued slide after the source slide number", () => {
  const info = { title: "Execution paths", hasTitle: true };
  assert.equal(slideLabel(info, 2, 3), "Slide 2 of 3: Execution paths");
  assert.equal(slideLabel(info, 2, 3, 2, 2), "Slide 2 of 3, page 2 of 2: Execution paths");
});

test("windows share the page of the showing slide", () => {
  const channels = new Map();
  class Channel {
    constructor(name) { this.name = name; (channels.get(name) ?? channels.set(name, new Set()).get(name)).add(this); }
    postMessage(data) { for (const peer of channels.get(this.name)) if (peer !== this) peer.onmessage?.({ data: structuredClone(data) }); }
    close() { channels.get(this.name).delete(this); }
  }
  const received = [];
  const a = createSync({ name: "deck", id: "a", BroadcastChannelImpl: Channel, onState: () => {} });
  createSync({ name: "deck", id: "b", BroadcastChannelImpl: Channel, onState: (state) => received.push(state) });
  a.post({ index: 1, page: 1, blank: "none", rev: 3 });
  assert.deepEqual(received.at(-1), { index: 1, page: 1, blank: "none", rev: 3, from: "a", reply: false });
  // A window without pages (an older player) is read as the first page.
  const old = new Channel("deck");
  old.postMessage({ v: 1, type: "state", from: "c", rev: 4, index: 3, blank: "none" });
  assert.deepEqual(received.at(-1), { index: 3, page: 0, blank: "none", rev: 4, from: "c", reply: false });
});

test("server markup draws a continued slide as its pages, labeled as sub-steps", () => {
  const document = deck();
  const html = toHtml(document, "1-", { renderOptions: { catalogs } });
  const labels = [...html.matchAll(/<figure[^>]*aria-label="([^"]*)"/g)].map((match) => match[1]);
  assert.deepEqual(labels, ["Slide 1 of 3: Plan", "Slide 2 of 3, page 1 of 2: Execution paths for the next cycle", "Slide 2 of 3, page 2 of 2: Execution paths for the next cycle", "Slide 3 of 3: Next steps"]);
  const off = toHtml(document, "1-", { renderOptions: { catalogs }, continuation: false });
  assert.equal([...off.matchAll(/<figure/g)].length, 3);
});
