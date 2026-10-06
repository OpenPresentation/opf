// Property tests: whatever a conversion accepts, it never invents text (every word of the result came from the
// source, apart from the fixed column headings), it loses no word unless it reports a loss, it validates as OPF,
// it does not change its input and it is deterministic. Inputs are generated from a seeded generator so a failure
// reproduces.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CONTENT_CONVERSIONS, OPFConversionError, convertContent, convertListForm, demoteListItems, promoteListItems } from "../dist/convert.js";
import { check } from './support/validation.mjs';


function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const WORDS = ["alpha", "beta", "gamma", "delta", "Q3", "2026", "North", "café", "naïve", "日本語", "launch", "pilot", "42", "3.5", "red", "Zed", "growth", "plan"];
// The fixed column headings of timeline and metric tables, and the `title` of a code fence's file name.
const HEADINGS = new Set(["When", "What", "Description", "Label", "Value", "Unit", "Delta", "Trend", "title", "up", "down", "flat"]);

function generator(seed) {
  const random = rng(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const int = (min, max) => min + Math.floor(random() * (max - min + 1));
  const words = (count = int(1, 4)) => Array.from({ length: count }, () => pick(WORDS)).join(" ");
  const maybe = (probability, make) => (random() < probability ? make() : undefined);
  const defined = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
  const runs = () => (random() < 0.25 ? [words(2) + " ", { text: words(1), bold: true }, " " + words(1)] : words());
  const line = () => {
    const marker = pick(["", "", "", "- ", "* ", "• ", "1. "]);
    return `${" ".repeat(pick([0, 0, 0, 2, 4]))}${marker}${words()}`;
  };
  const dated = () => `${pick(["2024", "Q1 2026", "Jan", "2026-03", "Week 3", "plain"])}${pick([" — ", ": ", " - ", " "])}${words()}`;
  return {
    tabbed: () => {
      const width = int(2, 3);
      const cell = () => pick([words(2), String(int(1, 99))]);
      const rows = Array.from({ length: int(1, 4) }, () => Array.from({ length: width }, cell));
      const markdown = ["| " + Array.from({ length: width }, cell).join(" | ") + " |", "| " + Array(width).fill("---").join(" | ") + " |", ...rows.map((row) => "| " + row.join(" | ") + " |")];
      return random() < 0.5 ? { text: rows.map((row) => row.join("\t")).join("\n") } : { text: markdown.join("\n") };
    },
    text: () => ({ text: random() < 0.2 ? runs() : Array.from({ length: int(1, 5) }, random() < 0.4 ? dated : line).join("\n") }),
    list: () => ({
      items: Array.from({ length: int(1, 5) }, () => {
        const level = pick([0, 0, 0, 1, 2]);
        return random() < 0.5 ? runs() : defined({ text: runs(), description: maybe(0.5, words), level: level || undefined });
      }),
    }),
    quote: () => ({ quote: defined({ text: words(5), attribution: maybe(0.6, words), source: maybe(0.3, words) }) }),
    metric: () => ({ metric: defined({ value: random() < 0.5 ? int(1, 900) : `${int(1, 90)}%`, label: maybe(0.7, words), unit: maybe(0.3, () => pick(["k", "%", "ms"])), delta: maybe(0.4, () => pick(["+12%", -3])), trend: maybe(0.4, () => pick(["up", "down", "flat"])), description: maybe(0.3, words) }) }),
    code: () => ({ code: defined({ source: Array.from({ length: int(1, 3) }, () => words(2)).join("\n"), language: maybe(0.6, () => pick(["ts", "py", "bash"])), filename: maybe(0.3, () => `${pick(WORDS).replace(/\P{L}/gu, "x")}.ts`) }) }),
    timeline: () => ({ timeline: Array.from({ length: int(1, 4) }, () => defined({ when: maybe(0.7, () => pick(["2024", "Q1 2026", "Jan", "Launch week"])), what: words(2), description: maybe(0.4, words) })) }),
    table: () => {
      const width = int(1, 4);
      const columns = maybe(0.7, () => Array.from({ length: width }, (_, index) => pick(["When", "What", "Description", "Label", "Value", "Unit", "Name", "Role", "Notes"]) + (random() < 0.5 ? "" : ` ${index}`)));
      return { table: defined({ columns, rows: Array.from({ length: int(1, 4) }, () => Array.from({ length: width }, () => pick([words(2), int(1, 99), null, ""]))) }) };
    },
    chart: () => ({ chart: { type: "column", data: { columns: ["Category", "A", "B"], rows: Array.from({ length: int(1, 4) }, () => [words(1), int(1, 50), maybe(0.8, () => int(1, 50)) ?? null]) } } }),
    group: () => ({ blocks: Array.from({ length: int(1, 4) }, () => ({ metric: random() < 0.3 ? int(1, 99) : defined({ value: int(1, 99), label: maybe(0.7, words), unit: maybe(0.3, () => "%"), delta: maybe(0.3, () => "+1"), trend: maybe(0.3, () => "up") }) })) }),
  };
}

// Every word (letters and digits) of every string and number in the payload, except type names, level numbers and the trend vocabulary.
function tokens(value, out = new Map(), key = "", skip = "") {
  if (typeof value === "string") {
    if (key === "type" || key === "trend") return out;
    for (const token of value.match(/[\p{L}\p{N}]+/gu) ?? []) out.set(token, (out.get(token) ?? 0) + 1);
  } else if (typeof value === "number") {
    if (key !== "level") for (const token of String(value).match(/[\p{L}\p{N}]+/gu) ?? []) out.set(token, (out.get(token) ?? 0) + 1);
  } else if (Array.isArray(value)) for (const entry of value) tokens(entry, out, key, skip);
  else if (value && typeof value === "object") for (const [name, entry] of Object.entries(value)) if (name !== skip) tokens(entry, out, name, skip);
  return out;
}

// The words up, down and flat, wherever they stand: as a metric's trend or as a table cell.
const trendWords = (payload) => {
  const found = [];
  const visit = (value) => {
    if (typeof value === "string" && ["up", "down", "flat"].includes(value)) found.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(payload);
  return found.sort();
};

describe("conversions never invent or silently lose text", () => {
  for (const [from, targets] of Object.entries(CONTENT_CONVERSIONS)) {
    for (const to of targets) {
      test(`${from} to ${to} over 300 generated inputs`, () => {
        const make = generator(0xc0ffee ^ from.length * 131 ^ to.length * 17);
        let converted = 0;
        let refusals = 0;
        for (let round = 0; round < 300; round++) {
          const source = (from === "text" && to === "table" ? make.tabbed : make[from])();
          const before = structuredClone(source);
          let result;
          try {
            result = convertContent(source, to);
          } catch (error) {
            assert.ok(error instanceof OPFConversionError, `${from}->${to}: ${error.stack}`);
            assert.equal(error.code, "not-convertible", `${error.message} for ${JSON.stringify(source)}`);
            assert.ok(error.message.length > 10);
            refusals++;
            continue;
          }
          converted++;
          const context = `${from}->${to} ${JSON.stringify(source)} => ${JSON.stringify(result.payload)} loss=${JSON.stringify(result.loss)}`;
          assert.deepEqual(source, before, "input unchanged");
          assert.deepEqual(convertContent(source, to), result, "deterministic");
          assert.equal(result.lossless, result.loss.length === 0);
          if (to !== "metrics") assert.ok(check({ slides: [{ blocks: [result.payload] }] }).valid, context);
          else assert.ok(check({ slides: [{ blocks: [result.payload] }] }).valid, context);
          // A table's heading words name a role (when, what, value...) for timeline and metrics: the role is kept, so the heading words are structure.
          const input = tokens(source, new Map(), "", from === "table" && (to === "timeline" || to === "metrics") ? "columns" : "");
          const output = tokens(result.payload);
          for (const [token, count] of output) {
            const allowed = (input.get(token) ?? 0) + (HEADINGS.has(token) ? 99 : 0);
            assert.ok(count <= allowed, `invented "${token}": ${context}`);
          }
          // A number the converter reads from text ("007") or writes as text keeps its digits; nothing else changes.
          if (result.lossless) {
            for (const [token, count] of input) {
              if (HEADINGS.has(token) && !input.has(token)) continue;
              assert.ok((output.get(token) ?? 0) >= count, `lost "${token}" without reporting it: ${context}`);
            }
            // Trend words are part of a metric, not text: they only change place between metrics and tables.
            if (from === "group" || to === "metrics") assert.deepEqual(trendWords(source), trendWords(result.payload));
          }
        }
        assert.ok(converted > 0, `${from}->${to} converted nothing in 300 rounds (${refusals} refusals)`);
      });
    }
  }
});

describe("round trips that are lossless stay lossless", () => {
  const make = generator(20261001);
  const round = (source, via, back) => {
    const there = convertContent(source, via);
    const again = convertContent(there.payload, back);
    return { there, again };
  };

  test("list <-> table without nesting", () => {
    for (let index = 0; index < 200; index++) {
      const source = make.list();
      source.items = source.items.map((item) => (item && typeof item === "object" && !Array.isArray(item) ? { ...item, level: undefined } : item)).map((item) => (item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)) : item));
      const { there, again } = round(source, "table", "list");
      assert.equal(there.lossless, true);
      assert.equal(again.lossless, true);
      const flat = (items) => items.map((item) => (item && typeof item === "object" && !Array.isArray(item) && Object.keys(item).length === 1 ? item.text : item));
      assert.deepEqual(flat(again.payload.items), flat(source.items));
    }
  });

  test("timeline <-> table", () => {
    for (let index = 0; index < 200; index++) {
      const source = make.timeline();
      const { there, again } = round(source, "table", "timeline");
      assert.equal(there.lossless, true);
      assert.deepEqual(again.payload, source);
    }
  });

  test("metric sets <-> table", () => {
    for (let index = 0; index < 200; index++) {
      const source = make.group();
      const { there, again } = round(source, "table", "metrics");
      assert.equal(there.lossless, true);
      const normal = (blocks) => blocks.map((block) => (typeof block.metric === "object" ? block : { metric: { value: block.metric } }));
      assert.deepEqual(normal(again.payload.blocks), normal(source.blocks));
    }
  });

  test("code <-> text keeps the language and file name", () => {
    for (let index = 0; index < 200; index++) {
      const source = make.code();
      const { there, again } = round(source, "text", "code");
      assert.equal(there.lossless, true);
      assert.deepEqual(again.payload, source);
    }
  });

  test("quote <-> text keeps the attribution and source when there is an attribution", () => {
    for (let index = 0; index < 200; index++) {
      const source = make.quote();
      if (source.quote.source && !source.quote.attribution) continue;
      const { there, again } = round(source, "text", "quote");
      assert.equal(there.lossless, true);
      assert.deepEqual(again.payload, source);
    }
  });

  test("table <-> text keeps plain cells as text", () => {
    for (let index = 0; index < 200; index++) {
      const source = make.table();
      const stringified = { table: { ...source.table, ...(source.table.columns ? { columns: source.table.columns.map(String) } : {}), rows: source.table.rows.map((row) => row.map((cell) => (cell === null ? "" : String(cell)))) } };
      if (stringified.table.rows.every((row) => row.length === 1 && row[0] === "") || (!stringified.table.columns && stringified.table.rows.some((row) => row.some((cell) => cell.trim() !== cell)))) continue;
      let there;
      try {
        there = convertContent(stringified, "text");
      } catch {
        continue;
      }
      if (!there.lossless) continue;
      let again;
      try {
        again = convertContent(there.payload, "table");
      } catch {
        continue;
      }
      // Cells that are padded by spaces are trimmed on the way back; everything else is identical.
      const trim = (table) => ({ ...table, rows: table.rows.map((row) => row.map((cell) => cell.trim())), ...(table.columns ? { columns: table.columns.map((cell) => cell.trim()) } : {}) });
      assert.deepEqual(trim(again.payload.table), trim(stringified.table));
    }
  });

  test("text <-> list keeps indentation levels", () => {
    for (let index = 0; index < 200; index++) {
      const source = make.list();
      const items = source.items.map((item) => (typeof item === "string" ? item : Array.isArray(item) ? { text: item } : item));
      const plain = { items: items.filter((item) => !item.description).map((item) => (typeof item === "string" ? item : item.text)).map((text) => (typeof text === "string" && /^\s|\s$/.test(text) ? text.trim() : text)) };
      if (!plain.items.length || plain.items.some((text) => Array.isArray(text))) continue;
      const { there, again } = round(plain, "text", "list");
      assert.equal(there.lossless, true);
      assert.deepEqual(again.payload, plain);
    }
  });

  test("list promote undoes demote on a valid outline and never change the text", () => {
    const random = rng(77);
    for (let index = 0; index < 300; index++) {
      const levels = [];
      for (let position = 0; position < 2 + Math.floor(random() * 6); position++) levels.push(position === 0 ? 0 : Math.floor(random() * (levels[position - 1] + 2)));
      const source = { items: levels.map((level, position) => (level ? { text: `item ${position}`, level } : `item ${position}`)) };
      const target = [Math.floor(random() * levels.length)];
      const down = demoteListItems(source, target);
      if (down.changed) {
        assert.deepEqual([...tokens(down.payload)].sort(), [...tokens(source)].sort());
        assert.equal(down.lossless, true);
        for (const [position, level] of down.levels.entries()) assert.ok(level <= (position ? down.levels[position - 1] + 1 : 0), `valid outline: ${JSON.stringify(down.levels)}`);
        assert.deepEqual(promoteListItems(down.payload, target).payload, source);
      }
      const up = promoteListItems(source, target);
      if (up.changed) {
        for (const [position, level] of up.levels.entries()) assert.ok(level >= 0 && level <= (position ? up.levels[position - 1] + 1 : 0));
      }
    }
  });

  test("list forms convert back and forth", () => {
    for (let index = 0; index < 100; index++) {
      const source = { items: make.list().items.map((item) => (item && typeof item === "object" && !Array.isArray(item) ? { text: item.text, level: item.level } : item)).map((item) => (item && typeof item === "object" && !Array.isArray(item) && item.level === undefined ? item.text : item)) };
      const to = convertListForm(source, "bullets");
      assert.equal(to.lossless, true);
      assert.deepEqual(convertListForm(to.payload, "items").payload, source);
    }
  });
});
