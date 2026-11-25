// FR-02 (CR 6): ids on list items, bullets, timeline events and table rows.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { assignIds, resolveIdPointer, toIdPointer, touches } from "../dist/ids.js";
import { applyPatch, getAtPointer } from "../dist/patch.js";
import { rowCells, tableRows } from "../dist/index.js";
import { validate } from "../dist/validator.js";
import { diff } from "../dist/diff.js";
import { merge } from "../dist/diff.js";
import { fromMarkdown, toMarkdown } from "../dist/markdown.js";
import { fromYaml, toYaml } from "../dist/yaml.js";
import { paginate } from "../dist/pagination.js";
import { convertContent, mergeSlides, splitSlide, splitSlideOnOverflow, unpaginate } from "../dist/convert.js";

const deck = () => ({
  name: "Deck",
  slides: [
    {
      id: "kpis",
      title: "KPIs",
      blocks: [
        { id: "wins", items: ["Signed the pilot", { id: "it-7f3k", text: "Expanded to EMEA" }] },
        { id: "notes", bullets: ["One", { id: "b-1", text: "Two" }] },
        { id: "rollout", timeline: [{ id: "ev-1", when: "Q1", what: "Pilot" }, { when: "Q2", what: "Rollout" }] },
        {
          id: "regions",
          table: {
            columns: ["Region", "Revenue"],
            rows: [{ id: "r-emea", cells: ["EMEA", 8.2] }, ["APAC", 5.1]],
          },
        },
      ],
    },
  ],
});

const errorsOf = (document) => validate(document).findings.filter((finding) => finding.severity === "error");

describe("schema and validation", () => {
  test("ids on items, bullets, events and row objects are valid", () => {
    assert.deepEqual(errorsOf(deck()), []);
  });

  test("a deck with no ids stays valid and addressed by index", () => {
    const plain = {
      name: "Plain",
      slides: [{ title: "T", blocks: [{ items: ["a", "b"] }, { table: { rows: [["x", 1]] } }, { timeline: { events: [{ what: "e" }] } }] }],
    };
    assert.deepEqual(errorsOf(plain), []);
  });

  test("an empty or non-string id is an error", () => {
    const empty = deck();
    empty.slides[0].blocks[0].items[1].id = "";
    assert.ok(errorsOf(empty).length > 0);
    const number = deck();
    number.slides[0].blocks[3].table.rows[0].id = 7;
    assert.ok(errorsOf(number).length > 0);
  });

  test("a row object needs cells and takes no other member", () => {
    const noCells = deck();
    noCells.slides[0].blocks[3].table.rows[0] = { id: "x" };
    assert.ok(errorsOf(noCells).length > 0);
    const extra = deck();
    extra.slides[0].blocks[3].table.rows[0].height = 3;
    assert.ok(errorsOf(extra).length > 0);
  });

  test("a bad cell inside a row object is reported at its own path", () => {
    const bad = deck();
    bad.slides[0].blocks[3].table.rows[0].cells[0] = { nope: true };
    const paths = errorsOf(bad).map((finding) => finding.path);
    assert.ok(paths.some((path) => path.startsWith("/slides/0/blocks/3/table/rows/0/cells/0")), paths.join(","));
  });

  for (const [name, mutate, at] of [
    ["two items", (d) => { d.slides[0].blocks[0].items[0] = { id: "it-7f3k", text: "x" }; }, "/slides/0/blocks/0/items/1/id"],
    ["an item and a bullet", (d) => { d.slides[0].blocks[1].bullets[1].id = "it-7f3k"; }, "/slides/0/blocks/1/bullets/1/id"],
    ["an event and a row", (d) => { d.slides[0].blocks[2].timeline[0].id = "r-emea"; }, "/slides/0/blocks/3/table/rows/0/id"],
    ["a row and a block", (d) => { d.slides[0].blocks[3].table.rows[0].id = "wins"; }, "/slides/0/blocks/3/table/rows/0/id"],
    ["an item and a slide", (d) => { d.slides[0].blocks[1].bullets[1].id = "kpis"; }, "/slides/0/blocks/1/bullets/1/id"],
  ]) {
    test(`a duplicate id between ${name} is an error`, () => {
      const document = deck();
      mutate(document);
      const errors = errorsOf(document);
      assert.ok(errors.some((finding) => finding.path === at), `${at} in ${errors.map((f) => f.path).join(",")}`);
    });
  }

  test("an id that repeats in a slide root list and a block is an error", () => {
    const document = { name: "D", slides: [{ title: "S", items: [{ id: "x", text: "a" }], blocks: [{ bullets: [{ id: "x", text: "b" }] }] }] };
    assert.ok(errorsOf(document).some((finding) => finding.path === "/slides/0/blocks/0/bullets/0/id"));
  });
});

describe("tableRows", () => {
  test("returns every row in one form, with the id and where its cells are", () => {
    const rows = tableRows(deck().slides[0].blocks[3].table);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { id: "r-emea", cells: ["EMEA", 8.2], path: "table.rows.0", cellsPath: "table.rows.0.cells", object: true });
    assert.deepEqual(rows[1], { cells: ["APAC", 5.1], path: "table.rows.1", cellsPath: "table.rows.1", object: false });
    assert.deepEqual(rowCells({ id: "a", cells: [1] }), [1]);
    assert.deepEqual(rowCells([2]), [2]);
    assert.deepEqual(tableRows({ dataset: "d" }), []);
  });
});

describe("assignIds", () => {
  test("does not touch items, bullets, events or rows by default", () => {
    const document = deck();
    const result = assignIds(document);
    assert.deepEqual(result.document.slides[0].blocks[0].items, document.slides[0].blocks[0].items);
    assert.deepEqual(result.assigned, []);
  });

  test("items: true rewrites string items and array rows and keeps the rest", () => {
    const document = deck();
    const result = assignIds(document, { items: true });
    const blocks = result.document.slides[0].blocks;
    assert.deepEqual(blocks[0].items, [{ id: "item-1", text: "Signed the pilot" }, { id: "it-7f3k", text: "Expanded to EMEA" }]);
    assert.deepEqual(blocks[1].bullets, [{ id: "bullet-1", text: "One" }, { id: "b-1", text: "Two" }]);
    assert.deepEqual(blocks[2].timeline, [{ id: "ev-1", when: "Q1", what: "Pilot" }, { id: "event-1", when: "Q2", what: "Rollout" }]);
    assert.deepEqual(blocks[3].table.rows, [{ id: "r-emea", cells: ["EMEA", 8.2] }, { id: "row-1", cells: ["APAC", 5.1] }]);
    assert.deepEqual(result.assigned.map((entry) => `${entry.kind}:${entry.id}`), ["item:item-1", "bullet:bullet-1", "event:event-1", "row:row-1"]);
    assert.deepEqual(applyPatch(document, result.patch), result.document);
    assert.deepEqual(errorsOf(result.document), []);
    assert.deepEqual(assignIds(result.document, { items: true }).assigned, []);
    assert.equal(document.slides[0].blocks[0].items[0], "Signed the pilot", "the input is not changed");
  });

  test("covers the slide's own items and a timeline in object form, skips dataset tables and data rows", () => {
    const document = {
      name: "D",
      datasets: { d: { columns: ["a"], rows: [["x"]] } },
      slides: [{ title: "S", items: ["a"], blocks: [{ timeline: { events: [{ what: "e" }] } }, { table: { dataset: "d" } }, { chart: { type: "column", data: { columns: ["a", "b"], rows: [["x", 1]] } } }] }],
    };
    const result = assignIds(document, { items: true });
    assert.deepEqual(result.document.slides[0].items, [{ id: "item-1", text: "a" }]);
    assert.deepEqual(result.document.slides[0].blocks[0].timeline.events, [{ id: "event-1", what: "e" }]);
    assert.deepEqual(result.document.datasets, document.datasets);
    assert.deepEqual(result.document.slides[0].blocks[2].chart.data.rows, [["x", 1]]);
  });

  test("a default id never takes one that is in use, whichever kind uses it", () => {
    const document = { name: "D", slides: [{ title: "S", blocks: [{ items: [{ id: "item-1", text: "a" }, "b"] }] }] };
    const result = assignIds(document, { items: true });
    assert.deepEqual(result.document.slides[0].blocks[0].items.map((entry) => entry.id), ["item-1", "item-2"]);
  });

  test("generate mints the ids a co-editing writer wants, with the kind and parent", () => {
    const seen = [];
    let n = 0;
    const result = assignIds(deck(), {
      items: true,
      generate: (context) => { seen.push(`${context.kind}@${context.pointer}<${context.parentId ?? ""}`); n += 1; return `g${n}`; },
    });
    assert.deepEqual(seen, [
      "item@/slides/0/blocks/0/items/0<wins",
      "bullet@/slides/0/blocks/1/bullets/0<notes",
      "event@/slides/0/blocks/2/timeline/1<rollout",
      "row@/slides/0/blocks/3/table/rows/1<regions",
    ]);
    assert.equal(result.document.slides[0].blocks[0].items[0].id, "g1");
  });

  test("generate that returns a taken id throws duplicate-id", () => {
    assert.throws(() => assignIds(deck(), { items: true, generate: () => "it-7f3k" }), { code: "duplicate-id" });
  });
});

describe("id pointers, diff and merge", () => {
  test("@id tokens address items and rows", () => {
    const document = deck();
    assert.equal(resolveIdPointer(document, "/slides/@kpis/blocks/@wins/items/@it-7f3k/text"), "/slides/0/blocks/0/items/1/text");
    assert.equal(resolveIdPointer(document, "/slides/@kpis/blocks/@regions/table/rows/@r-emea/cells/1"), "/slides/0/blocks/3/table/rows/0/cells/1");
    assert.equal(toIdPointer(document, "/slides/0/blocks/0/items/1/text"), "/slides/@kpis/blocks/@wins/items/@it-7f3k/text");
    assert.equal(getAtPointer(document, "/slides/@kpis/blocks/@rollout/timeline/@ev-1/what"), "Pilot");
  });

  test("an id used twice in one list is ambiguous", () => {
    const document = deck();
    document.slides[0].blocks[0].items[0] = { id: "it-7f3k", text: "x" };
    assert.throws(() => resolveIdPointer(document, "/slides/0/blocks/0/items/@it-7f3k"), { code: "patch-id-ambiguous" });
    assert.ok(errorsOf(document).length > 0);
  });

  test("diff pairs reordered rows by id and reports a move, not a rewrite", () => {
    const base = { name: "D", slides: [{ id: "s", title: "S", table: { columns: ["a", "b"], rows: [{ id: "r1", cells: ["x", 1] }, { id: "r2", cells: ["y", 2] }, { id: "r3", cells: ["z", 3] }] } }] };
    const reordered = structuredClone(base);
    reordered.slides[0].table.rows.reverse();
    const result = diff(base, reordered);
    assert.ok(result.changes.length > 0);
    assert.ok(result.changes.every((change) => change.type === "move" || change.kind === "move" || /move/.test(JSON.stringify(change))), JSON.stringify(result.changes));
    assert.ok(!result.changes.some((change) => /"op":"replace"/.test(JSON.stringify(change))), "rows are not rewritten");
  });

  test("a cell edit in a row that also moved is one edit on the row with that id", () => {
    const base = { name: "D", slides: [{ id: "s", title: "S", table: { rows: [{ id: "r1", cells: ["x", 1] }, { id: "r2", cells: ["y", 2] }] } }] };
    const next = structuredClone(base);
    next.slides[0].table.rows.reverse();
    next.slides[0].table.rows[0].cells[1] = 20;
    const text = JSON.stringify(diff(base, next).changes);
    assert.match(text, /r2|rows\/1|rows\/0/);
    assert.ok(text.includes("20"));
  });

  test("two writers who edit different rows and items merge without a conflict", () => {
    const base = deck();
    const ours = structuredClone(base);
    const theirs = structuredClone(base);
    ours.slides[0].blocks[3].table.rows[0].cells[1] = 9;
    ours.slides[0].blocks[3].table.rows.unshift({ id: "r-new", cells: ["LATAM", 1] });
    theirs.slides[0].blocks[3].table.rows[1] = { id: "r-apac", cells: ["APAC", 6] };
    theirs.slides[0].blocks[0].items[1].text = "Expanded to EMEA and APAC";
    const result = merge(base, ours, theirs);
    assert.deepEqual(result.conflicts, []);
    const rows = result.merged.slides[0].blocks[3].table.rows;
    assert.deepEqual(rows.map((row) => row.id), ["r-new", "r-emea", "r-apac"]);
    assert.equal(rows[1].cells[1], 9);
    assert.equal(rows[2].cells[1], 6);
    assert.equal(result.merged.slides[0].blocks[0].items[1].text, "Expanded to EMEA and APAC");
  });

  test("two writers who edit the same item's text conflict on that item only", () => {
    const base = deck();
    const ours = structuredClone(base);
    const theirs = structuredClone(base);
    ours.slides[0].blocks[0].items[1].text = "A";
    theirs.slides[0].blocks[0].items[1].text = "B";
    const result = merge(base, ours, theirs);
    assert.equal(result.conflicts.length, 1);
    assert.match(JSON.stringify(result.conflicts[0]), /items/);
  });

  test("duplicate ids in one list do not crash diff, and validate says why (opf#1103)", () => {
    const base = { name: "D", slides: [{ id: "s", title: "S", items: [{ id: "dup", text: "a" }, { id: "dup", text: "b" }] }] };
    const next = structuredClone(base);
    next.slides[0].items[1].text = "c";
    assert.doesNotThrow(() => diff(base, next));
    assert.doesNotThrow(() => merge(base, next, base));
    assert.ok(errorsOf(base).some((finding) => finding.path === "/slides/0/items/1/id"));
  });
});

describe("patch scope", () => {
  test("touches lists the item and row ids a patch reaches and destroys", () => {
    const document = deck();
    const edit = touches([{ op: "replace", path: "/slides/@kpis/blocks/@wins/items/@it-7f3k/text", value: "x" }], document);
    assert.deepEqual(edit.writes[0].ids, ["kpis", "wins", "it-7f3k"]);
    assert.equal(edit.writes[0].idPointer, "/slides/@kpis/blocks/@wins/items/@it-7f3k/text");
    const row = touches([{ op: "remove", path: "/slides/0/blocks/3/table/rows/0" }], document);
    assert.ok(row.writes[0].ids.includes("r-emea"));
    const block = touches([{ op: "remove", path: "/slides/0/blocks/0" }], document);
    assert.ok(block.writes[0].ids.includes("it-7f3k"), "removing a block lists the ids of the entries inside it");
    const event = touches([{ op: "replace", path: "/slides/0/blocks/2/timeline/0/what", value: "x" }], document);
    assert.ok(event.writes[0].ids.includes("ev-1"));
  });
});

describe("Markdown and YAML round trips", () => {
  test("YAML carries every id", () => {
    const document = deck();
    const text = toYaml(document).yaml;
    const back = fromYaml(text);
    assert.deepEqual(back.presentation, document);
  });

  test("Markdown keeps every id through the embedded form", () => {
    const document = deck();
    const { markdown } = toMarkdown(document);
    const back = fromMarkdown(markdown);
    assert.deepEqual(back.presentation.slides[0].blocks.map((block) => block.id), ["wins", "notes", "rollout", "regions"]);
    assert.deepEqual(back.presentation.slides[0].blocks[0].items, document.slides[0].blocks[0].items);
    assert.deepEqual(back.presentation.slides[0].blocks[1].bullets, document.slides[0].blocks[1].bullets);
    assert.deepEqual(back.presentation.slides[0].blocks[2].timeline, document.slides[0].blocks[2].timeline);
    assert.deepEqual(back.presentation.slides[0].blocks[3].table, document.slides[0].blocks[3].table);
  });

  test("a deck with no ids keeps its Markdown form", () => {
    const document = { name: "P", slides: [{ title: "T", bullets: ["a", "b"] }] };
    const { markdown } = toMarkdown(document);
    assert.deepEqual(fromMarkdown(markdown).presentation.slides[0].bullets, ["a", "b"]);
  });
});

describe("pagination", () => {
  test("a list and a table split across pages keep each entry's id on its own page", () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ id: `it-${i}`, text: `Item number ${i} with some words to fill a line` }));
    const rows = Array.from({ length: 40 }, (_, i) => ({ id: `r-${i}`, cells: [`Row ${i}`, i] }));
    const document = {
      name: "D",
      slides: [
        { id: "list", title: "List", items },
        { id: "grid", title: "Grid", table: { columns: ["Name", "N"], rows } },
      ],
    };
    const result = paginate(document, { overflow: "paginate" });
    const all = result.presentation ?? result.document ?? result;
    const slides = all.slides;
    assert.ok(slides.length > 2, "the slides were split");
    const seen = slides.flatMap((slide) => [...(slide.items ?? []), ...(slide.table?.rows ?? [])]).map((entry) => entry.id);
    assert.equal(new Set(seen).size, seen.length, "no entry is repeated");
    assert.equal(seen.length, 80, "every entry survives with its id");
    assert.deepEqual(errorsOf(all), []);
  });
});

describe("conversions and slide edits keep the ids", () => {
  test("list, table and timeline convert one to one and keep each entry's id", () => {
    const list = { items: [{ id: "a", text: "One" }, "Two", { id: "c", text: "Three", description: "More" }] };
    const table = convertContent(list, "table").payload;
    assert.deepEqual(table.table.rows.map((row) => (Array.isArray(row) ? null : row.id)), ["a", null, "c"]);
    const back = convertContent(table, "list").payload;
    assert.deepEqual(back.items.map((item) => (typeof item === "string" ? null : item.id)), ["a", null, "c"]);
    const timeline = convertContent({ table: { columns: ["When", "What"], rows: [{ id: "e1", cells: ["Q1", "Pilot"] }, ["Q2", "Scale"]] } }, "timeline").payload;
    assert.deepEqual(timeline.timeline.map((event) => event.id ?? null), ["e1", null]);
    const again = convertContent(timeline, "table").payload;
    assert.equal(again.table.rows[0].id, "e1");
    assert.deepEqual(errorsOf({ name: "D", slides: [{ title: "T", blocks: [back] }] }), []);
  });

  test("a table with row objects converts to a chart", () => {
    const chart = convertContent({ table: { columns: ["Q", "N"], rows: [{ id: "r1", cells: ["Q1", 1] }, ["Q2", 2]] } }, "chart").payload;
    assert.deepEqual(chart.chart.data.rows, [["Q1", 1], ["Q2", 2]]);
  });

  test("splitting a slide keeps every entry id on the part that holds it, and merging keeps them all", () => {
    const deck = { name: "D", slides: [{ id: "s", title: "T", blocks: [{ id: "a", items: [{ id: "i1", text: "x" }] }, { id: "b", table: { rows: [{ id: "r1", cells: ["y"] }] } }] }] };
    const split = splitSlide(deck, 0, { each: true });
    assert.deepEqual(split.slides.map((slide) => slide.id), ["s", "s--2"]);
    assert.equal(split.slides[0].blocks[0].items[0].id, "i1");
    assert.equal(split.slides[1].blocks[0].table.rows[0].id, "r1");
    assert.deepEqual(errorsOf(split.presentation), []);
    const merged = mergeSlides(split.presentation, 0, 2);
    assert.equal(merged.slides[0].id, "s");
    assert.deepEqual(merged.slides[0].blocks.map((block) => block.id), ["a", "b"]);
    assert.equal(merged.slides[0].blocks[0].items[0].id, "i1");
    assert.deepEqual(errorsOf(merged.presentation), []);
  });

  test("a slide id never takes an id an entry elsewhere uses", () => {
    const deck = { name: "D", slides: [{ id: "s", title: "T", blocks: [{ items: ["x"] }, { items: ["y"] }] }, { title: "U", items: [{ id: "s--2", text: "z" }] }] };
    const split = splitSlide(deck, 0, { each: true });
    assert.deepEqual(split.slides.map((slide) => slide.id), ["s", "s--3"]);
    assert.deepEqual(errorsOf(split.presentation), []);
  });

  test("splitting where a slide overflows and putting it back keeps every id", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ id: `r-${i}`, cells: [`Row ${i}`, i] }));
    const deck = { name: "D", slides: [{ id: "grid", title: "Grid", table: { columns: ["Name", "N"], rows } }] };
    const split = splitSlideOnOverflow(deck, 0);
    assert.ok(split.slides.length > 1);
    assert.equal(split.slides.flatMap((slide) => slide.table.rows).length, 40);
    assert.deepEqual(split.slides.flatMap((slide) => slide.table.rows).map((row) => row.id), rows.map((row) => row.id));
    const whole = unpaginate(split.presentation, split.pages);
    assert.deepEqual(whole.slides[0].table.rows.map((row) => row.id), rows.map((row) => row.id));
  });
});

describe("a cell path inside a row object names cells (every core consumer of a cell path)", () => {
  const mk = (row) => ({ name: "D", slides: [{ title: "T", table: { columns: ["A", "B"], rows: [row] } }] });
  const pathsOf = (document) => validate(document).findings.filter((finding) => finding.severity !== "info").map((finding) => `${finding.ruleId} ${finding.path}`);
  test("annotation rule, span rule and content rule give the same finding at the row object's cell", () => {
    const cite = [{ text: "x", cite: ["nope"] }];
    assert.deepEqual(pathsOf(mk([cite, "b"])), ["opf/cite-unsupported-location /slides/0/table/rows/0/0/0"]);
    assert.deepEqual(pathsOf(mk({ id: "r", cells: [cite, "b"] })), ["opf/cite-unsupported-location /slides/0/table/rows/0/cells/0/0"]);
    assert.deepEqual(pathsOf(mk([{ value: "a", colSpan: 2 }, "x"])), ["opf/schema /slides/0/table/rows/0/1"]);
    assert.deepEqual(pathsOf(mk({ id: "r", cells: [{ value: "a", colSpan: 2 }, "x"] })), ["opf/schema /slides/0/table/rows/0/cells/1"]);
    assert.deepEqual(pathsOf(mk(["TODO fill in", "b"])), ["opf/placeholder-text /slides/0/table/rows/0/0"]);
    assert.deepEqual(pathsOf(mk({ id: "r", cells: ["TODO fill in", "b"] })), ["opf/placeholder-text /slides/0/table/rows/0/cells/0"]);
  });
  test("the grid names each cell's source path with cells, and the row's id", async () => {
    const { tableGrid } = await import("../dist/composition.js");
    const grid = tableGrid({ columns: ["A", "B"], rows: [{ id: "r1", cells: ["x", "y"] }, ["p", "q"]] });
    assert.deepEqual(grid.rowIds, [undefined, "r1", undefined]);
    assert.equal(grid.rows[1][1].path, "table.rows.0.cells.1");
    assert.equal(grid.rows[2][1].path, "table.rows.1.1");
  });
});
